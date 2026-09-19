import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { DigestScreen } from "@/screens/DigestScreen";
import { DIGEST_STACK_ROUTES } from "../shell-contract";
import type { DigestStackParamList } from "../types";

const Stack = createNativeStackNavigator<DigestStackParamList>();
type DigestRouteName = (typeof DIGEST_STACK_ROUTES)[number];

const DIGEST_ROUTE_COMPONENTS = {
  Digest: DigestScreen,
  Profile: ContactProfileScreen,
} as const satisfies Record<DigestRouteName, ComponentType<never>>;

export function DigestStack() {
  return (
    <Stack.Navigator
      initialRouteName="Digest"
      screenOptions={{ headerShown: false }}
    >
      {DIGEST_STACK_ROUTES.map((name) => {
        const component = DIGEST_ROUTE_COMPONENTS[name];
        return <Stack.Screen key={name} name={name} component={component} />;
      })}
    </Stack.Navigator>
  );
}
