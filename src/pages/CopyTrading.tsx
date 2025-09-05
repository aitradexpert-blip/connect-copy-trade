import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AppLayout from "@/components/AppLayout";
import { Search, Star, TrendingUp, Users, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const mockMasters = [
  {
    id: 1,
    name: "Alex Thompson",
    performance: "+42.5%",
    followers: 1247,
    rating: 4.8,
    riskLevel: "Medium",
  },
  {
    id: 2,
    name: "Maria Rodriguez",
    performance: "+38.2%",
    followers: 892,
    rating: 4.9,
    riskLevel: "Low",
  },
  {
    id: 3,
    name: "John Chen",
    performance: "+55.7%",
    followers: 2156,
    rating: 4.7,
    riskLevel: "High",
  },
];

const mockAccounts = [
  { id: "1", name: "Live Account 1", platform: "MT5" },
  { id: "2", name: "Demo Account", platform: "MT4" },
];

const mockFollowers = [
  {
    id: 1,
    name: "Account #1234",
    copyRatio: "1:1",
    commission: "$125.50",
    status: "Active",
  },
  {
    id: 2,
    name: "Account #5678",
    copyRatio: "0.5:1",
    commission: "$89.20",
    status: "Active",
  },
];

export default function CopyTrading() {
  const [selectedMaster, setSelectedMaster] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [copyRatio, setCopyRatio] = useState("1");
  const [slMultiplier, setSlMultiplier] = useState("1");
  const [tpMultiplier, setTpMultiplier] = useState("1");
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [isSlaveModalOpen, setIsSlaveModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [publishToCommunity, setPublishToCommunity] = useState(false);
  const [masterAccount, setMasterAccount] = useState("");

  const handleFollowMaster = (master: any) => {
    setSelectedMaster(master);
    setIsFollowModalOpen(true);
  };

  const handleConfirmFollow = () => {
    const account = mockAccounts.find(acc => acc.id === selectedAccount);
    if (account) {
      toast({
        title: "Successfully following master!",
        description: `Now copying ${selectedMaster.name} on ${account.name}`,
      });
      setIsFollowModalOpen(false);
      setSelectedAccount("");
      setCopyRatio("1");
      setSlMultiplier("1");
      setTpMultiplier("1");
    }
  };

  const filteredMasters = mockMasters.filter(master =>
    master.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Copy Trading</h1>
          <p className="text-muted-foreground mt-2">
            Follow successful traders or share your strategies with the community
          </p>
        </div>

        <Tabs defaultValue="follow" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="follow">Follow a Master</TabsTrigger>
            <TabsTrigger value="master">Become a Master</TabsTrigger>
          </TabsList>

          <TabsContent value="follow" className="space-y-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search master traders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMasters.map((master) => (
                <Card key={master.id} className="shadow-card hover:shadow-elevated transition-smooth">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between">
                      <span>{master.name}</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-warning fill-warning" />
                        <span className="text-sm text-muted-foreground">{master.rating}</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Performance</div>
                        <div className="font-medium text-profit">{master.performance}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Followers</div>
                        <div className="font-medium flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {master.followers}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      {master.riskLevel} Risk
                    </Badge>
                    <Button 
                      onClick={() => handleFollowMaster(master)}
                      className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                    >
                      Follow
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="master" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Your Master Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Select Master Account</Label>
                    <Select value={masterAccount} onValueChange={setMasterAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your master account" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.platform})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="publish"
                      checked={publishToCommunity}
                      onCheckedChange={setPublishToCommunity}
                    />
                    <Label htmlFor="publish">Publish to Community</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Your Followers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Copy Ratio</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockFollowers.map((follower) => (
                      <TableRow key={follower.id}>
                        <TableCell>{follower.name}</TableCell>
                        <TableCell>{follower.copyRatio}</TableCell>
                        <TableCell className="text-profit">{follower.commission}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20">
                            {follower.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Connect Slave Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setIsSlaveModalOpen(true)}
                  className="bg-gradient-primary hover:opacity-90 transition-smooth"
                >
                  Add Slave Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Follow Master Modal */}
        <Dialog open={isFollowModalOpen} onOpenChange={setIsFollowModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Follow Master Trader</DialogTitle>
            </DialogHeader>
            {selectedMaster && (
              <div className="space-y-6">
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <h3 className="font-medium text-lg">{selectedMaster.name}</h3>
                  <div className="text-sm text-profit mt-1">
                    Performance: {selectedMaster.performance}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedMaster.followers} followers • {selectedMaster.rating} ⭐
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Slave Account</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose account to copy trades" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.platform})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Copy Ratio</Label>
                      <Input
                        value={copyRatio}
                        onChange={(e) => setCopyRatio(e.target.value)}
                        placeholder="1.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SL Multiplier</Label>
                      <Input
                        value={slMultiplier}
                        onChange={(e) => setSlMultiplier(e.target.value)}
                        placeholder="1.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TP Multiplier</Label>
                      <Input
                        value={tpMultiplier}
                        onChange={(e) => setTpMultiplier(e.target.value)}
                        placeholder="1.0"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleConfirmFollow}
                  disabled={!selectedAccount}
                  className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                >
                  Start Following
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Slave Account Modal */}
        <Dialog open={isSlaveModalOpen} onOpenChange={setIsSlaveModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Slave Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input placeholder="My Slave Account" />
              </div>
              <div className="space-y-2">
                <Label>Account ID</Label>
                <Input placeholder="12345678" />
              </div>
              <div className="space-y-2">
                <Label>MetaAPI Token</Label>
                <Input type="password" placeholder="Your MetaAPI token" />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mt4">MetaTrader 4</SelectItem>
                    <SelectItem value="mt5">MetaTrader 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => {
                  toast({
                    title: "Slave account connected!",
                    description: "Account ready for copy trading",
                  });
                  setIsSlaveModalOpen(false);
                }}
                className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
              >
                Connect Slave Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}