import { NativeModule, requireNativeModule } from "expo";

import type { ContactSummary, PickContactsOptions, PickedContact } from "..";

declare class OrbitContactPickerModule extends NativeModule<
  Record<never, never>
> {
  isContactPickerAvailable(): boolean;
  pickContacts(options: PickContactsOptions): Promise<PickedContact[]>;
  readAllContacts(): Promise<PickedContact[]>;
  listContactsSummary(): Promise<ContactSummary[]>;
  readContactsByLookupKeys(lookupKeys: string[]): Promise<PickedContact[]>;
}

export default requireNativeModule<OrbitContactPickerModule>(
  "OrbitContactPicker",
);
