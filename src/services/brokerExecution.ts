@@
   try {
-    const primary = await primaryApi.sendOrder({
-      accountId: account.metaapi_account_id,
-      symbol: signal.symbol,
-      order_type: signal.direction.toLowerCase(),
-      volume: signal.volume,
-      sl: signal.stopLoss ?? null,
-      tp: signal.takeProfit ?? null,
-    });
-    return {
-      success: true,
-      tradeId: (primary as any)?.tradeId || (primary as any)?.positionId || (primary as any)?.order,
-      provider: 'metaapi',
-    };
+    const primary = await primaryApi.sendOrder({
+      accountId: account.metaapi_account_id,
+      symbol: signal.symbol,
+      order_type: signal.direction.toLowerCase(),
+      volume: signal.volume,
+      sl: signal.stopLoss ?? null,
+      tp: signal.takeProfit ?? null,
+    });
+    // If the primary engine (VPS) answered with a structured rejection, treat it as a real failure.
+    if (primary && (primary as any).success === false) {
+      console.error('[BrokerExecution] Primary order rejected (VPS):', (primary as any).error);
+      return { success: false, error: (primary as any).error || 'Primary engine rejected order', provider: 'metaapi' };
+    }
+    return {
+      success: true,
+      tradeId: (primary as any)?.tradeId || (primary as any)?.positionId || (primary as any)?.order,
+      provider: 'metaapi',
+    };
   } catch (primaryErr: any) {
@@
