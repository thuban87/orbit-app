import { NativeModule, requireNativeModule } from "expo";

import type { ContactSummary, PickContactsOptions, PickedContact } from "..";

declare class OrbitContactPickerModule extends NativeModule<
  Record<never, never>
> {
  isContactPickerAvailable(): boolean;
  pickContacts(options: PickContactsOptions): Promise<PickedContact[]>;
  readAllContacts(): Promise<PickedContact[]>;
  listContactsSummary(): Promise<ContactSummary[]>;
  /** D-137: preferFullSize is true only on import reads. */
  readContactsByLookupKeys(
    lookupKeys: string[],
    preferFullSize: boolean,
  ): Promise<PickedContact[]>;
}

export default requireNativeModule<OrbitContactPickerModule>(
  "OrbitContactPicker",
);
