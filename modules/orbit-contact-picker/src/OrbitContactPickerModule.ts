import { NativeModule, requireNativeModule } from "expo";

import type { PickContactsOptions, PickedContact } from "..";

declare class OrbitContactPickerModule extends NativeModule<
  Record<never, never>
> {
  isContactPickerAvailable(): boolean;
  pickContacts(options: PickContactsOptions): Promise<PickedContact[]>;
}

export default requireNativeModule<OrbitContactPickerModule>(
  "OrbitContactPicker",
);
