@@
               body: JSON.stringify({
-                accountId: account.id,
+                account_id: account.id,
                 symbol: signal.symbol,
                 order_type: String(signal.direction || '').toLowerCase(),
                 volume: signal.lot_size,
                 sl: signal.stop_loss ?? null,
                 tp: signal.take_profit ?? null,
               }),
             });
