UPDATE subscription_plans SET auto_trades_limit = 30 WHERE lower(name) = 'basic';
UPDATE subscription_plans SET auto_trades_limit = 100 WHERE lower(name) = 'professional';
UPDATE subscription_plans SET auto_trades_limit = 1000 WHERE lower(name) = 'enterprise';
UPDATE subscription_plans SET auto_trades_limit = 3000 WHERE lower(name) = 'mentor';