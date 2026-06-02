-- Revert subscription_plans to the original pricing (USD * 18 exchange rate)
UPDATE subscription_plans SET price_zar = 178.20, price_usd = 9.90 WHERE name = 'basic';
UPDATE subscription_plans SET price_zar = 538.20, price_usd = 29.90 WHERE name = 'professional';
UPDATE subscription_plans SET price_zar = 719.82, price_usd = 39.99 WHERE name = 'enterprise';