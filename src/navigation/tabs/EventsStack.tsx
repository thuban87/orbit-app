import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { GroupEventDetailScreen } from "@/screens/GroupEventDetailScreen";
import { GroupEventsScreen } from "@/screens/GroupEventsScreen";
import { EVENTS_STACK_ROUTES } from "../shell-contract";
import type { EventsStackParamList } from "../types";

const Stack = createNativeStackNavigator<EventsStackParamList>();
type EventsRouteName = (typeof EVENTS_STACK_ROUTES)[number];

const EVENTS_ROUTE_COMPONENTS = {
  GroupEvents: GroupEventsScreen,
  GroupEventDetail: GroupEventDetailScreen,
  Profile: ContactProfileScreen,
} as const satisfies Record<EventsRouteName, ComponentType<never>>;

export function EventsStack() {
  return (
    <Stack.Navigator
      initialRouteName="GroupEvents"
      screenOptions={{ headerShown: false }}
    >
      {EVENTS_STACK_ROUTES.map((name) => {
        const component = EVENTS_ROUTE_COMPONENTS[name];
        return <Stack.Screen key={name} name={name} component={component} />;
      })}
    </Stack.Navigator>
  );
}
