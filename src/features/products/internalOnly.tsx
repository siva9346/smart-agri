import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../hooks/useApi';
import { Empty } from '../../ui';

/**
 * The product catalogue is for internal roles only. Customers see products solely
 * inside quotations shared with them, so a catalogue screen reached by any route
 * (stale link, push, manual navigation) renders nothing for them — the API refuses too.
 */
export function internalOnly<P extends object>(Screen: React.ComponentType<P>) {
  const Guarded = (props: P) => {
    const { isInternal } = useAuth();
    if (!isInternal) {
      return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty title="Not available" description="Products are shared with you through quotations. See My Quotations." />
        </View>
      );
    }
    return <Screen {...props} />;
  };
  Guarded.displayName = `InternalOnly(${Screen.displayName || Screen.name || 'Screen'})`;
  return Guarded;
}
