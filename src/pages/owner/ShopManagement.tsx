import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Gift, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Reward {
  id: string;
  title: string;
  description?: string;
  points_cost: number;
  stock?: number;
  active: boolean;
}

export function ShopManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReward, setNewReward] = useState({
    title: "",
    description: "",
    points_cost: 0,
    stock: 0,
    active: true,
  });

  useEffect(() => {
    if (organization) {
      fetchRewards();
    }
  }, [organization]);

  const fetchRewards = async () => {
    if (!organization) return;
    
    try {
      const { data } = await supabase
        .from("rewards")
        .select("*")
        .eq("organization_id", organization.id)
        .order("points_cost");

      if (data) {
        setRewards(data);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReward = async () => {
    if (!organization) {
      toast({
        title: "Error",
        description: "No organization selected",
        variant: "destructive",
      });
      return;
    }

    if (!newReward.title.trim()) {
      toast({
        title: "Error",
        description: "Reward title is required",
        variant: "destructive",
      });
      return;
    }

    if (newReward.points_cost <= 0) {
      toast({
        title: "Error",
        description: "Points cost must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("rewards")
        .insert({
          ...newReward,
          organization_id: organization.id,
          stock: newReward.stock > 0 ? newReward.stock : null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reward created successfully",
      });

      setDialogOpen(false);
      setNewReward({
        title: "",
        description: "",
        points_cost: 0,
        stock: 0,
        active: true,
      });
      fetchRewards();
    } catch (error) {
      console.error("Error creating reward:", error);
      toast({
        title: "Error",
        description: "Failed to create reward",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (rewardId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("rewards")
        .update({ active: !currentActive })
        .eq("id", rewardId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Reward ${!currentActive ? "activated" : "deactivated"}`,
      });

      fetchRewards();
    } catch (error) {
      console.error("Error updating reward:", error);
      toast({
        title: "Error",
        description: "Failed to update reward",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Shop Management</h1>
                <p className="text-sm text-muted-foreground">Manage rewards and gifts</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Reward
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Reward</DialogTitle>
                  <DialogDescription>
                    Add a new reward to the shop
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reward-title">Reward Title</Label>
                    <Input
                      id="reward-title"
                      value={newReward.title}
                      onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                      placeholder="Enter reward title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reward-description">Description</Label>
                    <Textarea
                      id="reward-description"
                      value={newReward.description}
                      onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                      placeholder="Enter reward description"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="points-cost">Points Cost</Label>
                      <Input
                        id="points-cost"
                        type="number"
                        min="1"
                        value={newReward.points_cost === 0 ? "" : newReward.points_cost}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            setNewReward({ ...newReward, points_cost: 0 });
                          } else {
                            const numValue = parseInt(value) || 0;
                            setNewReward({ ...newReward, points_cost: numValue });
                          }
                        }}
                        onFocus={(e) => {
                          if (e.target.value === "0" || e.target.value === "") {
                            e.target.select();
                          }
                        }}
                        placeholder="Enter points cost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock (Optional)</Label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        value={newReward.stock === 0 ? "" : newReward.stock}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            setNewReward({ ...newReward, stock: 0 });
                          } else {
                            const numValue = parseInt(value) || 0;
                            setNewReward({ ...newReward, stock: numValue });
                          }
                        }}
                        onFocus={(e) => {
                          if (e.target.value === "0" || e.target.value === "") {
                            e.target.select();
                          }
                        }}
                        placeholder="Enter stock amount (leave empty for unlimited)"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Active</Label>
                    <Switch
                      id="active"
                      checked={newReward.active}
                      onCheckedChange={(checked) => setNewReward({ ...newReward, active: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateReward}>Create Reward</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {rewards.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Gift className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No rewards yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first reward for the shop
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Reward
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <Card key={reward.id} className={!reward.active ? "opacity-60" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      {reward.title}
                    </div>
                    <Switch
                      checked={reward.active}
                      onCheckedChange={() => handleToggleActive(reward.id, reward.active)}
                    />
                  </CardTitle>
                  <CardDescription>
                    {reward.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cost:</span>
                      <div className="flex items-center gap-1 font-bold text-primary">
                        <Coins className="w-4 h-4" />
                        {reward.points_cost}
                      </div>
                    </div>
                    {reward.stock !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Stock:</span>
                        <span className="font-medium">{reward.stock}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
