import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ArrowLeft, Users, Plus, Trash2, UserPlus, X, Edit2 } from "lucide-react";
import { Link } from "react-router-dom";

interface Team {
  id: string;
  name: string;
  description?: string;
  supervisor_id?: string;
  created_at: string;
  created_by?: string;
  supervisor?: {
    id: string;
    email: string;
    full_name?: string;
    phone?: string | null;
  };
  created_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  users: {
    email: string;
    full_name?: string;
    phone?: string | null;
  };
}

interface OrgMember {
  user_id: string;
  role: string;
  users: {
    email: string;
    full_name?: string;
    phone?: string | null;
  };
}

export function TeamManagement() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [supervisors, setSupervisors] = useState<OrgMember[]>([]);
  const [employees, setEmployees] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTeamDialogOpen, setEditTeamDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    supervisor_id: "",
  });

  const [selectedEmployee, setSelectedEmployee] = useState("");

  useEffect(() => {
    if (organization) {
      fetchTeams();
      fetchOrganizationMembers();
    }
  }, [organization]);

  const fetchTeams = async () => {
    try {
      if (!organization) return;

      // @ts-ignore - teams table will be available after migration
      const { data: teamsData, error } = await (supabase as any)
        .from("teams")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch supervisor and creator details for each team
      if (teamsData && teamsData.length > 0) {
        const supervisorIds = teamsData
          .filter((team: any) => team.supervisor_id)
          .map((team: any) => team.supervisor_id);

        const createdByIds = teamsData
          .filter((team: any) => team.created_by)
          .map((team: any) => team.created_by);

        const allUserIds = [...new Set([...supervisorIds, ...createdByIds])];

        if (allUserIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, email, full_name, phone")
            .in("id", allUserIds);

          // Map supervisor and creator data to teams
          const teamsWithUsers = teamsData.map((team: any) => ({
            ...team,
            supervisor: usersData?.find((s) => s.id === team.supervisor_id),
            created_by_user: usersData?.find((u) => u.id === team.created_by),
          }));

          setTeams(teamsWithUsers);
        } else {
          setTeams(teamsData);
        }
      } else {
        setTeams([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch teams",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationMembers = async () => {
    try {
      if (!organization) return;

      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, users(email, full_name, phone)")
        .eq("organization_id", organization.id)
        .in("role", ["supervisor", "employee"]);

      if (error) throw error;

      const members = data || [];
      setSupervisors(members.filter((m) => m.role === "supervisor"));
      setEmployees(members.filter((m) => m.role === "employee"));
    } catch (error: any) {
      console.error("Error fetching organization members:", error);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      // @ts-ignore - team_members table will be available after migration
      const { data: membersData, error } = await (supabase as any)
        .from("team_members")
        .select("*")
        .eq("team_id", teamId);

      if (error) throw error;

      if (membersData && membersData.length > 0) {
        // Fetch user details for each member
        const userIds = membersData.map((m: any) => m.user_id);
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, full_name, phone")
          .in("id", userIds);

        // Map user data to team members
        const membersWithUsers = membersData.map((member: any) => ({
          ...member,
          users: usersData?.find((u) => u.id === member.user_id) || { email: "Unknown", full_name: null },
        }));

        setTeamMembers(membersWithUsers);
      } else {
        setTeamMembers([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch team members",
        variant: "destructive",
      });
    }
  };

  const handleCreateTeam = async () => {
    try {
      if (!organization) return;
      if (!formData.name.trim()) {
        toast({
          title: "Error",
          description: "Team name is required",
          variant: "destructive",
        });
        return;
      }

      if (!formData.supervisor_id) {
        toast({
          title: "Error",
          description: "Please assign a supervisor to the team",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const teamData: any = {
        organization_id: organization.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        created_by: user.id,
      };

      teamData.supervisor_id = formData.supervisor_id;

      // @ts-ignore - teams table will be available after migration
      const { data, error } = await (supabase as any)
        .from("teams")
        .insert(teamData)
        .select()
        .single();

      if (error) throw error;

      // Add supervisor to team_members
      // @ts-ignore - team_members table will be available after migration
      await (supabase as any).from("team_members").insert({
        team_id: data.id,
        user_id: formData.supervisor_id,
      });

      toast({
        title: "Success",
        description: "Team created successfully",
      });

      setCreateDialogOpen(false);
      setFormData({ name: "", description: "", supervisor_id: "" });
      fetchTeams();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTeam = async () => {
    try {
      if (!selectedTeam || !formData.name.trim()) {
        toast({
          title: "Error",
          description: "Team name is required",
          variant: "destructive",
        });
        return;
      }

      // @ts-ignore - teams table will be available after migration
      const { error } = await (supabase as any)
        .from("teams")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        })
        .eq("id", selectedTeam.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team updated successfully",
      });

      setEditTeamDialogOpen(false);
      setFormData({ name: "", description: "", supervisor_id: "" });
      fetchTeams();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async () => {
    try {
      if (!selectedTeam || !selectedEmployee || selectedEmployee === "unassigned") {
        toast({
          title: "Error",
          description: "Please select a team member",
          variant: "destructive",
        });
        return;
      }

      // @ts-ignore - team_members table will be available after migration
      const { error } = await (supabase as any).from("team_members").insert({
        team_id: selectedTeam.id,
        user_id: selectedEmployee,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Error",
            description: "This user is already a member of this team",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Success",
        description: "Team member added successfully",
      });

      setAddMemberDialogOpen(false);
      setSelectedEmployee("");
      fetchTeamMembers(selectedTeam.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, teamId: string) => {
    try {
      // @ts-ignore - team_members table will be available after migration
      const { error } = await (supabase as any)
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member removed successfully",
      });

      fetchTeamMembers(teamId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeam = async () => {
    try {
      if (!teamToDelete) return;

      // @ts-ignore - teams table will be available after migration
      const { error } = await (supabase as any)
        .from("teams")
        .delete()
        .eq("id", teamToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team deleted successfully",
      });

      setDeleteDialogOpen(false);
      setTeamToDelete(null);
      fetchTeams();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      });
    }
  };

  const handleViewTeam = (team: Team) => {
    setSelectedTeam(team);
    fetchTeamMembers(team.id);
  };

  const getAvailableEmployees = () => {
    if (!selectedTeam) return employees;
    
    // Filter out employees already in the team
    const memberIds = teamMembers.map((m) => m.user_id);
    return employees.filter((e) => !memberIds.includes(e.user_id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>No organization selected</p>
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
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Team Management</h1>
                <p className="text-sm text-muted-foreground">
                  Manage teams and assign members
                </p>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-2 space-y-4">
            {teams.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first team to organize your workforce
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Team
                  </Button>
                </CardContent>
              </Card>
            ) : (
              teams.map((team) => (
                <Card
                  key={team.id}
                  variant="interactive"
                  className="cursor-pointer"
                  onClick={() => handleViewTeam(team)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          {team.name}
                        </CardTitle>
                        <CardDescription>
                          {team.description || "No description provided"}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeam(team);
                            setFormData({ name: team.name, description: team.description || "", supervisor_id: "" });
                            setEditTeamDialogOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 text-primary" />
                        </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamToDelete(team.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Supervisor: </span>
                          <Badge variant="outline">
                            {team.supervisor?.full_name || team.supervisor?.email || "Unassigned"}
                          </Badge>
                        </div>
                        {team.created_by_user && (
                          <div>
                            <span className="text-muted-foreground">Created by: </span>
                            <Badge variant="secondary">
                              {team.created_by_user.full_name || team.created_by_user.email}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTeam(team);
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Team Details Sidebar */}
          <div>
            {selectedTeam ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{selectedTeam.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTeam(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>Team Members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setAddMemberDialogOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>

                  <div className="space-y-2">
                    {teamMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No team members yet
                      </p>
                    ) : (
                      teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {member.users.email.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {member.users.full_name || member.users.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.users.email}
                              </p>
                              {member.users.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {member.users.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, selectedTeam.id)}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Select a team to view its members
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Create a team and assign a supervisor to lead it
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name">
                Team Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Development Team"
              />
            </div>
            <div>
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the team's purpose and responsibilities"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="supervisor">Assign Supervisor</Label>
              <Select
                value={formData.supervisor_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, supervisor_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a Supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.user_id} value={supervisor.user_id}>
                      {supervisor.users.full_name || supervisor.users.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam}>Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add an employee to {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee">Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Select an employee</SelectItem>
                  {getAvailableEmployees().map((employee) => (
                    <SelectItem key={employee.user_id} value={employee.user_id}>
                      {employee.users.full_name || employee.users.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddMemberDialogOpen(false);
                setSelectedEmployee("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddMember}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editTeamDialogOpen} onOpenChange={setEditTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-team-name">
                Team Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-team-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Development Team"
              />
            </div>
            <div>
              <Label htmlFor="edit-team-description">Description</Label>
              <Textarea
                id="edit-team-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the team's purpose and responsibilities"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTeam}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Team Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team? This action cannot be undone.
              All team members will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTeamToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

