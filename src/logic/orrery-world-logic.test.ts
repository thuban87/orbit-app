import { describe, expect, it } from "vitest";
import type { OrrerySystemMember } from "@/db/orrery-system-read";
import { progressToAngle } from "@/logic/orrery-geometry-logic";
import { deriveOrreryWorld, DENSITY_PRESETS, MAX_NUDGE_ANGLE, MAX_NUDGE_WORLD, NEUTRAL_RESTING_ANGLE, gravityMassModifier } from "@/logic/orrery-world-logic";
import { computeContactGravity } from "@/services/impact";

function member(id: number, overrides: Partial<OrrerySystemMember> = {}): OrrerySystemMember {
  return { id,uid:`uid-${id}`,name:`Person ${id}`,photo:null,ring_seq:id,status:"stable",progress:0,last_contact:"2026-09-07",rarely_responds:0,favourite_rank:null,...overrides };
}
const sun = { id:0, kind:"sun" as const,x:0,y:0,radius:30,ringRadius:0 };
describe("density-aware canonical world", () => {
  it.each([0,1,6,10,100])("grows %i dense rings with count-independent minimum spacing and finite extent", (count) => {
    const members = Array.from({length:count},(_,i)=>member(i+1));
    for (const density of ["spacious","balanced","compact"] as const) {
      const result = deriveOrreryWorld(members,density,new Map(),sun);
      expect(result.bodies).toHaveLength(count+1);
      expect(Number.isFinite(result.extent)).toBe(true);
      for (let i=1;i<count;i++) expect(result.bodies[i].ringRadius-result.bodies[i-1].ringRadius).toBe(DENSITY_PRESETS[density].ringGap);
      if(count===100) expect(result.extent).toBeGreaterThan(3000);
    }
  });
  it("uses dense display ranks without rewriting sparse/equal/null stored ranks; ties use creation then id", () => {
    const members = [
      {...member(4,{ring_seq:null}),created_at:"2026-01-01"},
      {...member(3,{ring_seq:50}),created_at:"2026-01-01"},
      {...member(2,{ring_seq:50}),created_at:"2026-01-01"},
      {...member(1,{ring_seq:50}),created_at:"2025-01-01"},
    ];
    const before = structuredClone(members);
    const result = deriveOrreryWorld(members,"balanced",new Map(),sun);
    expect(result.bodies.map((b)=>b.id)).toEqual([1,2,3,4,0]);
    expect(members).toEqual(before);
  });
  it("preserves neutral and timestamp semantics across all densities with deterministic bounded local nudges", () => {
    const members = [member(1,{progress:null,status:null,last_contact:null}), member(2,{progress:3,status:"rogue"}),member(3,{progress:0,status:"stable"}),member(4,{progress:0,status:"stable"})];
    for(const density of ["spacious","balanced","compact"] as const) {
      const first=deriveOrreryWorld(members,density,new Map(),sun);
      expect(deriveOrreryWorld(members,density,new Map(),sun)).toEqual(first);
      expect(first.bodies[0]).toMatchObject({x:0,y:-first.bodies[0].ringRadius});
      for(const body of first.bodies.slice(0,-1)) {
        expect(Math.abs(body.nudgeAngle ?? 0)).toBeLessThanOrEqual(MAX_NUDGE_ANGLE);
        expect(Math.abs(body.nudgeAngle ?? 0)*Math.hypot(body.x,body.y)).toBeLessThanOrEqual(MAX_NUDGE_WORLD+1e-9);
      }
      expect(first.bodies[0].angle).toBe(NEUTRAL_RESTING_ANGLE);
      expect(first.bodies[2].angle!-(first.bodies[2].nudgeAngle ?? 0)).toBe(progressToAngle(0));
    }
    expect(members[0].progress).toBeNull();
  });
  it("only nudges collision neighbors, leaving isolated canonical angles exact",()=>{
    const collision=[member(1,{status:"rogue",progress:3}),member(2),member(3)];
    const result=deriveOrreryWorld(collision,"balanced",new Map(),sun);
    expect(result.bodies.some((b)=>(b.nudgeAngle ?? 0)!==0)).toBe(true);
    const isolated=deriveOrreryWorld([member(1,{progress:0.2}),member(2,{progress:0.7})],"balanced",new Map(),sun);
    expect(isolated.bodies.every((b)=>(b.nudgeAngle ?? 0)===0)).toBe(true);
  });
  it("keeps canonical Gravity connected scope and bounded visual mass secondary to zoom",()=>{
    const inputs={trackingEnabled:1,intervalDays:30,rarelyResponds:1,interactions:Array.from({length:100},()=>({occurredAt:"2026-09-07",connected:0,direction:"inbound"}))};
    const low=computeContactGravity(inputs,"2026-09-07");
    const high=computeContactGravity({...inputs,rarelyResponds:0},"2026-09-07");
    expect(gravityMassModifier(low)).toBe(0.9);
    expect(gravityMassModifier(high)).toBe(1.1);
    const result=deriveOrreryWorld([member(1),member(2)],"balanced",new Map([[1,low],[2,high]]),sun);
    expect(result.bodies[0].radius).toBeLessThan(result.bodies[1].radius);
  });
});
