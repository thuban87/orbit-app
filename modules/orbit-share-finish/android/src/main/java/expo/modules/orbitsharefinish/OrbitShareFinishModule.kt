package expo.modules.orbitsharefinish

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Phase 10 (CAP-04) return-to-source bridge. expo-share-intent exposes no
// finish/return API, so capture supplies its own. This calls a PLAIN
// Activity.finish() — which, because the library re-launches capture as the
// task root, returns the user to the sharing app (Android 15 top-of-task finish
// rule). It deliberately does NOT use the remove-task or affinity finish
// variants (those land on the launcher) nor the RN back-handler exit path
// (its native mapping is RN-version-dependent and may also land on home).
class OrbitShareFinishModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OrbitShareFinish")

    Function("finish") {
      appContext.currentActivity?.finish()
    }
  }
}
