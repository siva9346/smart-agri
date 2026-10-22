import { createNavigationContainerRef } from '@react-navigation/native';

// Root-level ref so the drawer panels (which render as siblings of the Stack,
// not inside it) can navigate to any screen by name regardless of nesting.
export const navigationRef = createNavigationContainerRef();
