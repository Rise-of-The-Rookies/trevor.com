import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { OnlinePresence } from "../shared/OnlinePresence";
import { InvitationManager } from "../shared/InvitationManager";
import { ClockOutButton } from "../shared/ClockOutButton";
import { NotificationBell } from "../shared/NotificationBell";
import { Link } from "react-router-dom";
import { 
  Shield, 
  Users, 
  Building2, 
  Target, 
  Settings, 
  Coins,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  Gift,
  LogOut,
  User,
  UsersRound
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface AdminDashboardProps {
  organization: Organization;
  onLogout: () => void;
  onClockOut: () => void;
}

interface AdminStats {
  attendanceToday: number;
  totalMembers: number;
  managedProjects: number;
  totalTeams: number;
  teamProductivity: number;
  totalPoints: number;
}

export function AdminDashboard({ organization, onLogout, onClockOut }: AdminDashboardProps) {
  const [userId, setUserId] = useState<string>("");
  const [stats, setStats] = useState<AdminStats>({
    attendanceToday: 0,
    totalMembers: 0,
    managedProjects: 0,
    totalTeams: 0,
    teamProductivity: 0,
    totalPoints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUserId();
    fetchAdminStats();
  }, [organization.id]);

  const fetchAdminStats = async () => {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch admin-specific statistics
      const [attendanceData, membersData, projectsData, teamsData, completedTasksData] = await Promise.all([
        supabase
          .from('attendance_checkins')
          .select('user_id', { count: 'exact', head: false })
          .eq('org_id', organization.id)
          .eq('local_date', today),
        supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organization.id),
        supabase
          .from('projects')
          .select('id')
          .eq('organization_id', organization.id),
        // @ts-ignore - teams table will be available after migration
        (supabase as any)
          .from('teams')
          .select('id')
          .eq('organization_id', organization.id),
        supabase
          .from('tasks')
          .select('status, priority, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
          .eq('status', 'done')
      ]);

      const attendanceToday = attendanceData.data?.length || 0;
      const totalMembers = membersData.data?.length || 0;
      const managedProjects = projectsData.data?.length || 0;
      const totalTeams = teamsData.data?.length || 0;
      
      // Calculate total points and productivity
      const completedTasks = completedTasksData.data || [];
      const totalPoints = completedTasks.reduce((sum, task) => {
        const points = task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : 1;
        return sum + points;
      }, 0);
      
      const totalTasks = completedTasks.length;
      const teamProductivity = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

      setStats({
        attendanceToday,
        totalMembers,
        managedProjects,
        totalTeams,
        teamProductivity,
        totalPoints,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
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
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={organization.logo_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {organization.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">{organization.name}</h1>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-500" />
                  <p className="text-sm text-muted-foreground">Admin Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {userId && <NotificationBell userId={userId} />}
              <Link to="/admin/shop/manage">
                <Button variant="ghost" size="icon" aria-label="Manage Shop">
                  <Gift className="w-5 h-5" />
                </Button>
              </Link>
              <ModeToggle />
              <ClockOutButton 
                organizationId={organization.id}
                organizationName={organization.name}
                onClockOut={onClockOut}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Admin Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link to="/admin/time-logging">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Attendance Today</p>
                    <p className="text-2xl font-bold">{stats.attendanceToday}</p>
                  </div>
                  <div className="w-12 h-12 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Present", value: stats.attendanceToday },
                            { name: "Absent", value: Math.max(0, stats.totalMembers - stats.attendanceToday) },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={14}
                          outerRadius={24}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill="hsl(142, 76%, 36%)" />
                          <Cell fill="hsl(0, 84%, 60%)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/progress-tracking">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Managed Projects</p>
                    <p className="text-2xl font-bold">{stats.managedProjects}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/teams">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Teams</p>
                    <p className="text-2xl font-bold">{stats.totalTeams}</p>
                  </div>
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                    <UsersRound className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/analytics">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Team Productivity</p>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-bold">{stats.teamProductivity}%</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Coins className="w-4 h-4" />
                        <span>{stats.totalPoints}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Management Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Management Tools
                </CardTitle>
                <CardDescription>
                  Administrative functions and team management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Link to="/admin/manage-team">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Users className="w-6 h-6" />
                      <span>Manage Members</span>
                    </Button>
                  </Link>
                  <Link to="/admin/teams">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <UsersRound className="w-6 h-6" />
                      <span>Team Management</span>
                    </Button>
                  </Link>
                  <Link to="/admin/tasks/new">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Target className="w-6 h-6" />
                      <span>Create Task</span>
                    </Button>
                  </Link>
                  <Link to="/admin/assignments/new">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Users className="w-6 h-6" />
                      <span>Create Assignment</span>
                    </Button>
                  </Link>

                  <Link to="/admin/time-logging">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Clock className="w-6 h-6" />
                      <span>Time Logging</span>
                    </Button>
                  </Link>
                  <Link to="/admin/shop/manage">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Gift className="w-6 h-6" />
                      <span>Manage Shop</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Team Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Task Completion Rate</span>
                    <span className="text-sm font-bold text-success">{stats.teamProductivity}%</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Average Response Time</span>
                    <span className="text-sm font-bold">2.3 hours</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Team Satisfaction</span>
                    <span className="text-sm font-bold text-success">87%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Admin Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Recent Administrative Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Role updated for Alice Smith (Employee → Supervisor)</p>
                      <p className="text-xs text-muted-foreground">30 minutes ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">New team member Mike Johnson added to Design Team</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-warning rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Project "Q4 Campaign" deadline extended</p>
                      <p className="text-xs text-muted-foreground">1 day ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <OnlinePresence organizationId={organization.id} />
            <InvitationManager organizationId={organization.id} userRole="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}