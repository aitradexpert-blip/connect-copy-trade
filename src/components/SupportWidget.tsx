import { useNavigate } from 'react-router-dom';
import { Headphones, Mail, MessageCircle, Phone, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

export const SupportWidget = () => {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const planName = subscription?.subscription_plans?.name || 'basic';

  const supportChannels = {
    basic: [
      { type: 'email', label: 'Email Support', value: 'support@humi.app', response: '48 hours', icon: Mail }
    ],
    professional: [
      { type: 'email', label: 'Priority Email', value: 'priority@humi.app', response: '4 hours', icon: Mail },
      { type: 'chat', label: 'Live Chat', value: 'Open Chat', response: 'Instant', icon: MessageCircle }
    ],
    enterprise: [
      { type: 'phone', label: '24/7 Phone Support', value: '+27-11-555-HUMI', response: 'Immediate', icon: Phone },
      { type: 'email', label: 'VIP Email', value: 'vip@humi.app', response: '1 hour', icon: Mail },
      { type: 'chat', label: 'Dedicated Chat', value: 'Open Chat', response: 'Instant', icon: MessageCircle },
      { type: 'manager', label: 'Account Manager', value: 'Schedule Call', response: 'Same day', icon: UserCheck }
    ]
  };

  const channels = supportChannels[planName] || supportChannels.basic;

  const handleSupportAction = (channel: any) => {
    if (channel.type === 'email') {
      window.location.href = `mailto:${channel.value}`;
    } else if (channel.type === 'phone') {
      window.location.href = `tel:${channel.value}`;
    } else if (channel.type === 'chat') {
      // Open chat widget (implement chat system later)
      alert('Live chat feature coming soon!');
    } else if (channel.type === 'manager') {
      // Schedule call functionality
      alert('Account manager scheduling coming soon!');
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-primary" />
          Support Channels
        </CardTitle>
        <CardDescription>
          Your {planName} plan includes these support options
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {channels.map(channel => {
            const Icon = channel.icon;
            return (
              <div key={channel.type} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{channel.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Response time: {channel.response}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSupportAction(channel)}
                >
                  {channel.type === 'chat' ? 'Open' : 'Contact'}
                </Button>
              </div>
            );
          })}
        </div>

        {planName === 'basic' && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              💡 Upgrade to Professional for live chat and faster response times
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full" 
              onClick={() => navigate('/subscription')}
            >
              View Plans
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
