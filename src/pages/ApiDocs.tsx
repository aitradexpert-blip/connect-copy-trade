 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Badge } from "@/components/ui/badge";
 import { 
   ArrowLeft, 
   Code, 
   Building2, 
   Plug, 
   Webhook, 
   Shield, 
   CreditCard,
   TrendingUp,
   Database,
   Mail,
   ExternalLink
 } from "lucide-react";
 
 const ENDPOINTS = [
   {
     method: 'POST',
     path: '/auth/oauth',
     description: 'OAuth 2.0 authorization flow',
     category: 'Authentication',
   },
   {
     method: 'GET',
     path: '/account/info',
     description: 'Get account balance, equity, margin',
     category: 'Account',
   },
   {
     method: 'POST',
     path: '/trade/execute',
     description: 'Execute a market or pending order',
     category: 'Trading',
   },
   {
     method: 'GET',
     path: '/trade/positions',
     description: 'List all open positions',
     category: 'Trading',
   },
   {
     method: 'GET',
     path: '/trade/history',
     description: 'Get trade history with pagination',
     category: 'Trading',
   },
   {
     method: 'POST',
     path: '/funding/deposit',
     description: 'Generate deposit address/URL',
     category: 'Funding',
   },
   {
     method: 'POST',
     path: '/funding/withdraw',
     description: 'Initiate withdrawal request',
     category: 'Funding',
   },
   {
     method: 'POST',
     path: '/webhook/trade-update',
     description: 'Receive trade status updates',
     category: 'Webhooks',
   },
   {
     method: 'POST',
     path: '/webhook/balance-update',
     description: 'Receive balance change notifications',
     category: 'Webhooks',
   },
 ];
 
 export default function ApiDocs() {
   const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState('overview');
 
   return (
     <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
       {/* Header */}
       <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
         <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <div className="flex items-center gap-2">
             <Code className="w-6 h-6 text-primary" />
             <span className="text-xl font-bold text-foreground">HuMi API</span>
           </div>
           <Badge variant="secondary">Partner Documentation</Badge>
         </div>
       </div>
 
       {/* Main Content */}
       <div className="max-w-6xl mx-auto px-4 py-12">
         <div className="text-center mb-12">
           <h1 className="text-4xl font-bold text-foreground mb-4">
             Partner Integration Hub
           </h1>
           <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
             Integrate your brokerage or enterprise system with HuMi's Capital Management Platform
           </p>
         </div>
 
         <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
           <TabsList className="grid w-full grid-cols-4">
             <TabsTrigger value="overview">Overview</TabsTrigger>
             <TabsTrigger value="brokers">For Brokers</TabsTrigger>
             <TabsTrigger value="enterprise">For Enterprise</TabsTrigger>
             <TabsTrigger value="api">API Reference</TabsTrigger>
           </TabsList>
 
           <TabsContent value="overview" className="space-y-8">
             <div className="grid md:grid-cols-2 gap-6">
               <Card className="bg-gradient-card border-border shadow-card">
                 <CardHeader>
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-primary/10 rounded-lg">
                       <Plug className="w-6 h-6 text-primary" />
                     </div>
                     <div>
                       <CardTitle>MetaAPI Bridge</CardTitle>
                       <CardDescription>Recommended for MT4/MT5</CardDescription>
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <p className="text-sm text-muted-foreground">
                     Quick integration via MetaAPI's provisioning profiles. 
                     Compatible with 500+ brokers worldwide.
                   </p>
                   <ul className="text-sm space-y-2">
                     <li className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-green-500" />
                       No direct API development required
                     </li>
                     <li className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-green-500" />
                       Real-time trade synchronization
                     </li>
                     <li className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-green-500" />
                       CopyFactory support built-in
                     </li>
                   </ul>
                 </CardContent>
               </Card>
 
               <Card className="bg-gradient-card border-border shadow-card">
                 <CardHeader>
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-secondary/10 rounded-lg">
                       <Building2 className="w-6 h-6 text-secondary" />
                     </div>
                     <div>
                       <CardTitle>Direct API</CardTitle>
                       <CardDescription>Custom Enterprise Integration</CardDescription>
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <p className="text-sm text-muted-foreground">
                     Full API integration for brokers with existing REST APIs 
                     or proprietary trading platforms.
                   </p>
                   <ul className="text-sm space-y-2">
                     <li className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-green-500" />
                       Complete control over integration
                     </li>
                     <li className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-green-500" />
                       Custom authentication flows
                     </li>
                     <li className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-green-500" />
                       White-label options available
                     </li>
                   </ul>
                 </CardContent>
               </Card>
             </div>
 
             <Card className="bg-gradient-card border-border shadow-card">
               <CardHeader>
                 <CardTitle>Why Partner with HuMi?</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="grid md:grid-cols-3 gap-6">
                   <div className="text-center p-4">
                     <TrendingUp className="w-10 h-10 text-primary mx-auto mb-3" />
                     <h3 className="font-semibold mb-2">Increased Volume</h3>
                     <p className="text-sm text-muted-foreground">
                       Access our growing user base of active traders in the African market
                     </p>
                   </div>
                   <div className="text-center p-4">
                     <Database className="w-10 h-10 text-primary mx-auto mb-3" />
                     <h3 className="font-semibold mb-2">Unified Platform</h3>
                     <p className="text-sm text-muted-foreground">
                       Your clients manage all accounts from one intelligent dashboard
                     </p>
                   </div>
                   <div className="text-center p-4">
                     <CreditCard className="w-10 h-10 text-primary mx-auto mb-3" />
                     <h3 className="font-semibold mb-2">Fast Funding</h3>
                     <p className="text-sm text-muted-foreground">
                       Cross-broker transfers via crypto rails in hours, not days
                     </p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>
 
           <TabsContent value="brokers" className="space-y-8">
             <Card className="bg-gradient-card border-border shadow-card">
               <CardHeader>
                 <CardTitle>MetaAPI Provisioning Setup</CardTitle>
                 <CardDescription>For MT4/MT5 brokers using MetaAPI</CardDescription>
               </CardHeader>
               <CardContent className="space-y-6">
                 <div className="space-y-4">
                   <h4 className="font-medium">Step 1: Ensure MetaAPI Compatibility</h4>
                   <p className="text-sm text-muted-foreground">
                     Your broker must be registered in MetaAPI's supported broker list. 
                     Contact MetaAPI at <code className="bg-muted px-1 rounded">support@metaapi.cloud</code> if not listed.
                   </p>
                 </div>
 
                 <div className="space-y-4">
                   <h4 className="font-medium">Step 2: Server Configuration</h4>
                   <p className="text-sm text-muted-foreground">
                     Provide your server names to our team. Example format:
                   </p>
                   <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
 {`{
   "broker_name": "YourBroker",
   "mt4_servers": ["YourBroker-Live", "YourBroker-Demo"],
   "mt5_servers": ["YourBroker-MT5-Live", "YourBroker-MT5-Demo"]
 }`}
                   </pre>
                 </div>
 
                 <div className="space-y-4">
                   <h4 className="font-medium">Step 3: Test Connection</h4>
                   <p className="text-sm text-muted-foreground">Sample cURL request:</p>
                   <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
 {`curl -X POST https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts \\
   -H "auth-token: YOUR_METAAPI_TOKEN" \\
   -H "Content-Type: application/json" \\
   -d '{
     "login": "12345678",
     "password": "your_password",
     "name": "Test Account",
     "server": "YourBroker-Live",
     "platform": "mt4"
   }'`}
                   </pre>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>
 
           <TabsContent value="enterprise" className="space-y-8">
             <div className="grid md:grid-cols-2 gap-6">
               <Card className="bg-gradient-card border-border shadow-card">
                 <CardHeader>
                   <CardTitle>White-Label Solution</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <p className="text-sm text-muted-foreground">
                     Deploy HuMi under your own brand with custom theming, 
                     domain, and feature configuration.
                   </p>
                   <ul className="text-sm space-y-2">
                     <li>• Custom branding & logo</li>
                     <li>• Your domain (trading.yourbroker.com)</li>
                     <li>• Feature toggle control</li>
                     <li>• Dedicated support channel</li>
                   </ul>
                 </CardContent>
               </Card>
 
               <Card className="bg-gradient-card border-border shadow-card">
                 <CardHeader>
                   <CardTitle>Dedicated Infrastructure</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <p className="text-sm text-muted-foreground">
                     For high-volume partners requiring isolated environments 
                     with guaranteed performance.
                   </p>
                   <ul className="text-sm space-y-2">
                     <li>• Isolated database instance</li>
                     <li>• Dedicated edge function workers</li>
                     <li>• 99.9% SLA guarantee</li>
                     <li>• Priority incident response</li>
                   </ul>
                 </CardContent>
               </Card>
             </div>
           </TabsContent>
 
           <TabsContent value="api" className="space-y-8">
             <Card className="bg-gradient-card border-border shadow-card">
               <CardHeader>
                 <CardTitle>Required Endpoints</CardTitle>
                 <CardDescription>
                   Endpoints HuMi requires from your broker API for full integration
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   {['Authentication', 'Account', 'Trading', 'Funding', 'Webhooks'].map(category => (
                     <div key={category} className="space-y-2">
                       <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                         {category}
                       </h4>
                       <div className="space-y-2">
                         {ENDPOINTS.filter(e => e.category === category).map(endpoint => (
                           <div 
                             key={endpoint.path} 
                             className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                           >
                             <Badge variant={endpoint.method === 'GET' ? 'secondary' : 'default'}>
                               {endpoint.method}
                             </Badge>
                             <code className="text-sm font-mono">{endpoint.path}</code>
                             <span className="text-sm text-muted-foreground ml-auto">
                               {endpoint.description}
                             </span>
                           </div>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
 
             <Card className="bg-gradient-card border-border shadow-card">
               <CardHeader>
                 <CardTitle>Webhook Payload Example</CardTitle>
               </CardHeader>
               <CardContent>
                 <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
 {`// Trade Update Webhook
 POST /webhook/trade-update
 {
   "event": "trade.executed",
   "timestamp": "2025-02-05T12:00:00Z",
   "account_id": "12345678",
   "trade": {
     "id": "987654321",
     "symbol": "EURUSD",
     "type": "BUY",
     "volume": 0.1,
     "open_price": 1.08500,
     "status": "filled"
   }
 }`}
                 </pre>
               </CardContent>
             </Card>
           </TabsContent>
         </Tabs>
 
         {/* Contact CTA */}
         <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 mt-12">
           <CardContent className="py-8 text-center">
             <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
             <h3 className="text-2xl font-bold mb-2">Ready to Partner?</h3>
             <p className="text-muted-foreground mb-6 max-w-md mx-auto">
               Contact our partnerships team to discuss integration options and get started.
             </p>
             <Button size="lg" asChild>
               <a href="mailto:partnerships@humi.app">
                 <Mail className="w-4 h-4 mr-2" />
                 partnerships@humi.app
               </a>
             </Button>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }