import { describe, expect, it } from "vitest";
import { captureReorder, moveReorder, releaseReorder } from "./orrery-reorder-logic";
import { clampCameraPose, projectFrame } from "./orrery-camera-logic";

const request = {system: {kind:"builtin" as const,id:"all-contacts" as const}, expectedFullOrderedIds:[1,2,3], expectedSavedSunContactId:null, expectedEligibleVisibleIds:[1,2,3], expectedContactIdentities:[{id:1,uid:"a"},{id:2,uid:"b"},{id:3,uid:"c"}]};
const world = [1,2,3].map((id,i)=>({id,kind:"contact" as const,x:0,y:-(60+i*40+30),radius:10,ringRadius:60+i*40}));
const frame = projectFrame(world,clampCameraPose({x:0,y:0,zoom:1,tilt:0.5,yaw:0.6},300),{width:500,height:700},7);
describe("deliberate ring drag",()=>{
  it("stationary release remains same rank for drifted tilted/yawed targets, including off-center touch",()=>{
    const body=frame.bodies[1];
    const captured=captureReorder(frame,request,body.x+3,body.y+2)!;
    expect(captured).not.toBeNull();
    const moved=moveReorder(captured,frame,body.x+3,body.y+2);
    expect(moved.reorderedVisibleIds).toEqual([1,2,3]);
    expect(releaseReorder(moved,7,true)).toBeNull();
  });
  it("moves to the nearest eligible slot and emits only success in its captured generation",()=>{
    const a=frame.bodies[0], c=frame.bodies[2];
    const captured=captureReorder(frame,request,a.x,a.y)!;
    const moved=moveReorder(captured,frame,c.x,c.y);
    expect(moved.reorderedVisibleIds).toEqual([2,3,1]);
    expect(releaseReorder(moved,7,true)?.request.expectedContactIdentities).toEqual(request.expectedContactIdentities);
    expect(releaseReorder(moved,8,true)).toBeNull();
    expect(releaseReorder(moved,7,false)).toBeNull();
  });
  it("does not capture neutral or ambiguous targets",()=>{
    const a=frame.bodies[0];
    expect(captureReorder(frame,{...request,expectedEligibleVisibleIds:[2,3]},a.x,a.y)).toBeNull();
    expect(captureReorder({...frame,bodies:[...frame.bodies,{...a,id:4}]},request,a.x,a.y)).toBeNull();
  });
});
