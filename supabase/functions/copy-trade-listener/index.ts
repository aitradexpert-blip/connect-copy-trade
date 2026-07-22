@@
             body: JSON.stringify({
-              accountId: relationship.follower_account.id,
+              account_id: relationship.follower_account.id,
               symbol: signal.symbol,
               order_type: String(signal.direction || '').toLowerCase(),
               volume: adjustedVolume,
               sl: signal.stop_loss ?? null,
               tp: signal.take_profit ?? null,
             }),
           }).finally(() => clearTimeout(vpsTimeout));
