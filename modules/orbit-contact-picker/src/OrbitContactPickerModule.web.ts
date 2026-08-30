import { NativeModule, registerWebModule } from "expo";

import type { ContactSummary, PickContactsOptions, PickedContact } from "..";

// The Android 17 system picker has no web counterpart. Keep module parity so
// callers can use the availability probe without a platform-specific import.
class OrbitContactPickerModule extends NativeModule<Record<never, never>> {
  isContactPickerAvailable(): boolean {
    return false;
  }

  async pickContacts(_: PickContactsOptions): Promise<PickedContact[]> {
    return [];
  }

  async readAllContacts(): Promise<PickedContact[]> {
    return [];
  }

  async listContactsSummary(): Promise<ContactSummary[]> {
    return [];
  }

  async readContactsByLookupKeys(_: string[]): Promise<PickedContact[]> {
    return [];
  }
}

export default registerWebModule(
  OrbitContactPickerModule,
  "OrbitContactPicker",
);
