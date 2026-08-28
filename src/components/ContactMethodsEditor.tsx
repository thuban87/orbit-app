import { Picker } from "@react-native-picker/picker";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { useTheme } from "@/theme";
import type {
  ContactMethodEditorDraft,
  MethodGroups,
} from "./contact-methods-editor-model";

const LABELS = ["Mobile", "Home", "Work", "Main", "Other"] as const;

export interface ContactMethodsEditorProps {
  methods: MethodGroups;
  onAdd: (type: ContactMethodType) => void;
  onUpdate: (
    uid: string,
    patch: Partial<Omit<ContactMethodEditorDraft, "uid" | "type" | "id">>,
  ) => void;
  onRemove: (uid: string) => void;
  onChoosePrimary: (uid: string) => void;
  duplicateHelper?: { type: ContactMethodType; copy: string } | null;
  testID?: string;
}

function typeCopy(type: ContactMethodType) {
  return type === "phone"
    ? {
        heading: "Phone numbers",
        empty: "No phone numbers yet",
        add: "+ Add phone number",
      }
    : {
        heading: "Email addresses",
        empty: "No email addresses yet",
        add: "+ Add email address",
      };
}

export function ContactMethodsEditor({
  methods,
  onAdd,
  onUpdate,
  onRemove,
  onChoosePrimary,
  duplicateHelper,
  testID,
}: ContactMethodsEditorProps) {
  const { colors } = useTheme();
  const inputStyle = [
    styles.input,
    {
      color: colors.textPrimary,
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
  ];

  const group = (type: ContactMethodType) => {
    const rows = methods[type];
    const copy = typeCopy(type);
    return (
      <View key={type} style={styles.group}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          {copy.heading}
        </Text>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {copy.empty}
          </Text>
        ) : null}
        {rows.map((row, index) => (
          <View
            key={row.uid}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.labelRow}>
              <View
                style={[styles.labelPicker, { borderColor: colors.border }]}
              >
                <Picker
                  selectedValue={
                    LABELS.includes(row.label as (typeof LABELS)[number])
                      ? row.label
                      : "Other"
                  }
                  onValueChange={(label) =>
                    onUpdate(row.uid, { label: String(label) })
                  }
                  accessibilityLabel={`${copy.heading} label`}
                  style={{ color: colors.textPrimary }}
                >
                  {LABELS.map((label) => (
                    <Picker.Item key={label} label={label} value={label} />
                  ))}
                </Picker>
              </View>
              <Pressable
                testID={`${testID ?? "contact-methods-editor"}-${type}-remove-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${copy.heading} ${index + 1}`}
                onPress={() => onRemove(row.uid)}
                style={styles.remove}
              >
                <Text style={{ color: colors.textSecondary }}>Remove</Text>
              </Pressable>
            </View>
            {row.label === "Other" ? (
              <TextInput
                value=""
                onChangeText={(label) => onUpdate(row.uid, { label })}
                placeholder="Custom label"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
                accessibilityLabel="Custom method label"
              />
            ) : null}
            <TextInput
              testID={`${testID ?? "contact-methods-editor"}-${type}-value-${index}`}
              accessibilityLabel={`${copy.heading} ${index + 1}`}
              value={row.value}
              onChangeText={(value) => onUpdate(row.uid, { value })}
              placeholder={type === "phone" ? "Phone number" : "Email address"}
              placeholderTextColor={colors.textSecondary}
              keyboardType={type === "phone" ? "phone-pad" : "email-address"}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            {type === "phone" ? (
              <TextInput
                value={row.extension}
                onChangeText={(extension) => onUpdate(row.uid, { extension })}
                placeholder="Extension"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                style={inputStyle}
                accessibilityLabel={`Phone extension ${index + 1}`}
              />
            ) : null}
            {rows.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Make ${copy.heading} ${index + 1} primary`}
                accessibilityState={{ selected: row.isPrimary === true }}
                onPress={() => onChoosePrimary(row.uid)}
                style={styles.primary}
              >
                <Text
                  style={{
                    color: row.isPrimary ? colors.accent : colors.textSecondary,
                  }}
                >
                  {row.isPrimary ? "Primary" : "Set as primary"}
                </Text>
              </Pressable>
            ) : (
              <Text
                style={[styles.primaryText, { color: colors.textSecondary }]}
              >
                Primary
              </Text>
            )}
            {row.isActionable === false ? (
              <Text style={[styles.helper, { color: colors.danger }]}>
                {type === "phone"
                  ? "This number can’t be used for calls or messages yet."
                  : "This email address can’t be used yet."}
              </Text>
            ) : null}
          </View>
        ))}
        {duplicateHelper?.type === type ? (
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            {duplicateHelper.copy}
          </Text>
        ) : null}
        <Pressable
          testID={`${testID ?? "contact-methods-editor"}-${type}-add`}
          accessibilityRole="button"
          accessibilityLabel={copy.add.slice(2)}
          onPress={() => onAdd(type)}
          style={styles.add}
        >
          <Text style={{ color: colors.accent, fontWeight: "600" }}>
            {copy.add}
          </Text>
        </Pressable>
      </View>
    );
  };
  return (
    <View testID={testID} style={styles.container}>
      {group("phone")}
      {group("email")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  group: { gap: 8 },
  heading: { fontSize: 16, fontWeight: "600" },
  empty: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  labelPicker: { flex: 1, borderWidth: 1, borderRadius: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  remove: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: { minHeight: 44, justifyContent: "center" },
  primaryText: { minHeight: 44, textAlignVertical: "center" },
  helper: { fontSize: 13, lineHeight: 18 },
  add: { minHeight: 44, justifyContent: "center" },
});
