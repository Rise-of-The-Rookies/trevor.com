import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Gift, Plus, Coins, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number | null;
  active: boolean;
}

export function ShopManagement() {
  const { organization } = useOrganization();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [newReward, setNewReward] = useState({
    title: "",
    description: "",
    points_cost: 0,
    stock: 0,
  });

  useEffect(() => {
    if (organization) {
      fetchRewards();
    }
  }, [organization]);

  const fetchRewards = async () => {
    if (!organization) return;
    
    try {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("organization_id", organization.id)
        .order("points_cost");

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      toast({
        title: "Error",
        description: "Failed to load rewards",
        variant: "destructive",
      });
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

    if (!newReward.title || newReward.points_cost <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("rewards").insert({
        organization_id: organization.id,
        title: newReward.title,
        description: newReward.description || null,
        points_cost: newReward.points_cost,
        stock: newReward.stock > 0 ? newReward.stock : null,
        active: true,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reward created successfully",
      });

      setNewReward({ title: "", description: "", points_cost: 0, stock: 0 });
      setIsDialogOpen(false);
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

  const handleUpdateReward = async () => {
    if (!editingReward) return;

    if (!editingReward.title.trim()) {
      toast({
        title: "Error",
        description: "Reward title is required",
        variant: "destructive",
      });
      return;
    }

    if (editingReward.points_cost <= 0) {
      toast({
        title: "Error",
        description: "Points cost must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error, data } = await supabase
        .from("rewards")
        .update({
          title: editingReward.title.trim(),
          description: editingReward.description?.trim() || null,
          points_cost: editingReward.points_cost,
          stock: editingReward.stock && editingReward.stock > 0 ? editingReward.stock : null,
          active: editingReward.active,
        })
        .eq("id", editingReward.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Reward update failed - no rows were updated");
      }

      toast({
        title: "Success",
        description: "Reward updated successfully",
      });

      setEditDialogOpen(false);
      setEditingReward(null);
      fetchRewards();
    } catch (error: any) {
      console.error("Error updating reward:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update reward",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReward = async (rewardId: string) => {
    try {
      const { error, data } = await supabase
        .from("rewards")
        .delete()
        .eq("id", rewardId)
        .select();

      if (error) {
        console.error("Error deleting reward:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error("Reward deletion failed - no rows were deleted");
      }

      toast({
        title: "Success",
        description: "Reward deleted successfully",
      });

      fetchRewards();
    } catch (error: any) {
      console.error("Error deleting reward:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete reward. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (reward: Reward) => {
    setEditingReward({
      ...reward,
      stock: reward.stock ?? 0,
    });
    setEditDialogOpen(true);
  };

  const handleToggleActive = async (rewardId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("rewards")
        .update({ active: !currentStatus })
        .eq("id", rewardId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Reward ${!currentStatus ? "activated" : "deactivated"}`,
      });

      fetchRewards();
    } catch (error) {
      console.error("Error toggling reward status:", error);
      toast({
        title: "Error",
        description: "Failed to update reward status",
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
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Shop Management</h1>
                <p className="text-sm text-muted-foreground">Manage rewards and gifts</p>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Reward
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Reward</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newReward.title}
                      onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                      placeholder="e.g., Amazon Gift Card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newReward.description}
                      onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points">Points Cost</Label>
                    <Input
                      id="points"
                      type="number"
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
                    <Label htmlFor="stock">Stock (leave 0 for unlimited)</Label>
                    <Input
                      id="stock"
                      type="number"
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
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateReward}>Create Reward</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Reward Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Reward</DialogTitle>
                  <DialogDescription>
                    Update the reward details
                  </DialogDescription>
                </DialogHeader>
                {editingReward && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="edit-title"
                        value={editingReward.title}
                        onChange={(e) => setEditingReward({ ...editingReward, title: e.target.value })}
                        placeholder="Enter reward title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editingReward.description || ""}
                        onChange={(e) => setEditingReward({ ...editingReward, description: e.target.value })}
                        placeholder="Enter reward description"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-points">Points Cost</Label>
                        <Input
                          id="edit-points"
                          type="number"
                          value={editingReward.points_cost === 0 ? "" : editingReward.points_cost}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setEditingReward({ ...editingReward, points_cost: 0 });
                            } else {
                              const numValue = parseInt(value) || 0;
                              setEditingReward({ ...editingReward, points_cost: numValue });
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
                        <Label htmlFor="edit-stock">Stock (leave 0 for unlimited)</Label>
                        <Input
                          id="edit-stock"
                          type="number"
                          value={editingReward.stock === 0 ? "" : editingReward.stock}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setEditingReward({ ...editingReward, stock: 0 });
                            } else {
                              const numValue = parseInt(value) || 0;
                              setEditingReward({ ...editingReward, stock: numValue });
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
                      <Label htmlFor="edit-active">Active</Label>
                      <Switch
                        id="edit-active"
                        checked={editingReward.active}
                        onCheckedChange={(checked) => setEditingReward({ ...editingReward, active: checked })}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateReward}>Update Reward</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {rewards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rewards Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first reward to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <Card key={reward.id} className={!reward.active ? "opacity-60" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    {reward.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reward.description && (
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-warning" />
                    <span className="font-bold text-lg">{reward.points_cost}</span>
                    <span className="text-sm text-muted-foreground">points</span>
                  </div>

                  {reward.stock !== null && (
                    <p className="text-sm text-muted-foreground">
                      Stock: {reward.stock} remaining
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <Label htmlFor={`active-${reward.id}`}>Active</Label>
                    <Switch
                      id={`active-${reward.id}`}
                      checked={reward.active}
                      onCheckedChange={() => handleToggleActive(reward.id, reward.active)}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(reward)}
                      className="flex-1"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Reward</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{reward.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteReward(reward.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
