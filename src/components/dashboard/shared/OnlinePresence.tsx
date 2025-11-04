import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Users, Crown, Shield, Eye, User, Circle, Settings } from "lucide-react";
import { PresenceProvider } from "@/contexts/PresenceContext";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OnlineUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  status: "online" | "idle" | "offline" | "do_not_disturb";
  current_task_id?: string;
  current_task_title?: string;
}

interface OnlinePresenceProps {
  organizationId: string;
}

const roleIcons = {
  owner: Crown,
  admin: Shield, 
  supervisor: Eye,
  employee: User,
};

const roleColors = {
  owner: "bg-gradient-to-r from-yellow-400 to-orange-500",
  admin: "bg-gradient-to-r from-purple-400 to-pink-500",
  supervisor: "bg-gradient-to-r from-blue-400 to-cyan-500",
  employee: "bg-gradient-to-r from-green-400 to-emerald-500",
};

const statusColors = {
  online: "bg-green-500",
  idle: "bg-yellow-500", 
  offline: "bg-gray-400",
  do_not_disturb: "bg-red-500",
};

const statusShapes = {
  online: "rounded-full",
  idle: "rounded-full", 
  offline: "rounded-full",
  do_not_disturb: "rounded-sm",
};

function OnlinePresenceComponent({ organizationId }: OnlinePresenceProps) {
  const [onlineUsers, setOnlineUsers] = useState<Record<UserRole, OnlineUser[]>>({
    owner: [],
    admin: [],
    supervisor: [],
    employee: [],
  });
  const [loading, setLoading] = useState(true);
  const [currentUserStatus, setCurrentUserStatus] = useState<"online" | "idle" | "offline" | "do_not_disturb">("online");
  
  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Get current user ID once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUserIdRef.current = user.id;
      }
    });
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    // Prevent duplicate calls
    if (isFetchingRef.current) {
      return;
    }
    
    isFetchingRef.current = true;
    try {
      // Removed console.log for production
      
      // First, let's try a simple query to get organization members
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId);
      
      if (membersError) {
        console.error('Error fetching organization members:', membersError);
        throw membersError;
      }
      
      if (!membersData || membersData.length === 0) {
        setOnlineUsers({
          owner: [],
          admin: [],
          supervisor: [],
          employee: [],
        });
        return;
      }
      
      // Get user details for each member
      const userIds = membersData.map(member => member.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }
      
      // Get attendance data for today
      const today = new Date().toISOString().split('T')[0];
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_checkins')
        .select('user_id, clock_in_at, clock_out_at, local_date')
        .eq('org_id', organizationId)
        .eq('local_date', today);
      
      // Get presence data
      const { data: presenceData, error: presenceError } = await supabase
        .from('user_presence')
        .select('user_id, status, updated_at, current_task_id')
        .in('user_id', userIds);

      const usersByRole: Record<UserRole, OnlineUser[]> = {
        owner: [],
        admin: [],
        supervisor: [],
        employee: [],
      };
      
      membersData.forEach((member: any) => {
        const user = usersData?.find(u => u.id === member.user_id);
        if (!user) return;
        
        const attendance = attendanceData?.find(a => a.user_id === member.user_id);
        const presence = presenceData?.find(p => p.user_id === member.user_id);
        
        // Determine user status based on attendance and activity
        let userStatus: "online" | "idle" | "offline" | "do_not_disturb" = 'offline';
        
        // Check if user is currently clocked in (no clock_out_at for today)
        const isClockedIn = attendance && 
          attendance.clock_in_at && 
          !attendance.clock_out_at;
        
        if (isClockedIn) {
          // User is clocked in, determine status based on activity
          if (presence?.updated_at) {
            const timeSinceUpdate = Date.now() - new Date(presence.updated_at).getTime();
            const twentyMinutes = 20 * 60 * 1000; // 20 minutes for idle
            
            if (timeSinceUpdate < twentyMinutes) {
              // Recent activity - use the stored status or default to online
              userStatus = presence.status as "online" | "idle" | "offline" | "do_not_disturb" || 'online';
            } else {
              // Idle if no activity for more than 20 minutes
              userStatus = 'idle';
            }
          } else {
            // No presence data, default to online if clocked in
            userStatus = 'online';
          }
        } else {
          // User is not clocked in or has clocked out
          userStatus = 'offline';
        }
        
        const onlineUser: OnlineUser = {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          avatar_url: user.avatar_url,
          role: member.role,
          status: userStatus,
          current_task_id: presence?.current_task_id,
          current_task_title: undefined, // We'll add task fetching later if needed
        };

        usersByRole[member.role as UserRole].push(onlineUser);
      });

      setOnlineUsers(usersByRole);
    } catch (error) {
      console.error('Error fetching online users:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    
    fetchOnlineUsers();
    
    // Set up real-time subscription for presence updates
    // Only react to changes from other users to avoid infinite loops
    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          // Only refresh if it's a change from another user
          if (payload.new && (payload.new as any).user_id !== currentUserIdRef.current) {
            // Debounce: wait a bit before fetching to avoid rapid successive calls
            setTimeout(() => {
              fetchOnlineUsers();
            }, 1000);
          }
        }
      )
      .subscribe();

    // Update our own presence
    updatePresence();

    // Set up periodic presence updates and idle detection
    const presenceInterval = setInterval(() => {
      updatePresence();
      fetchOnlineUsers(); // Refresh to update idle/offline status
    }, 30000); // Update every 30 seconds

    // Set up idle detection
    let idleTimer: NodeJS.Timeout;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        // Set user as idle after 20 minutes of inactivity
        try {
          const { data: user } = await supabase.auth.getUser();
          if (user.user) {
            await supabase
              .from('user_presence')
              .upsert({
                user_id: user.user.id,
                status: 'idle',
                updated_at: new Date().toISOString(),
              });
          }
        } catch (error) {
          console.error('Error setting idle status:', error);
        }
      }, 20 * 60 * 1000); // 20 minutes
    };

    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetIdleTimer, true);
    });

    resetIdleTimer();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(presenceInterval);
      clearTimeout(idleTimer);
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetIdleTimer, true);
      });
    };
  }, [organizationId, fetchOnlineUsers]);

  const updatePresence = async (status: "online" | "idle" | "offline" | "do_not_disturb" = "online") => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          status: status,
          updated_at: new Date().toISOString(),
        });
      
      setCurrentUserStatus(status);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  const handleStatusChange = async (newStatus: "online" | "idle" | "offline" | "do_not_disturb") => {
    await updatePresence(newStatus);
  };

  // Function to set user status to online when they clock in
  const setUserOnline = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          status: 'online',
          updated_at: new Date().toISOString(),
        });
      
      setCurrentUserStatus('online');
      // Refresh the user list to show updated status
      fetchOnlineUsers();
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  };

  // Function to set user status to offline when they clock out
  const setUserOffline = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          status: 'offline',
          updated_at: new Date().toISOString(),
        });
      
      setCurrentUserStatus('offline');
      // Refresh the user list to show updated status
      fetchOnlineUsers();
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  };

  const getTotalOnline = () => {
    return Object.values(onlineUsers).flat().filter(user => 
      user.status === 'online' || user.status === 'idle' || user.status === 'do_not_disturb'
    ).length;
  };

  const getTotalMembers = () => {
    return Object.values(onlineUsers).flat().length;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Presence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="w-24 h-4 bg-muted rounded"></div>
                  <div className="w-32 h-3 bg-muted rounded mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Presence
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2">
                  <div className={`w-2 h-2 rounded-full ${statusColors[currentUserStatus]} mr-2`}></div>
                  <span className="text-xs capitalize">{currentUserStatus.replace('_', ' ')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleStatusChange('online')}>
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  Online
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('idle')}>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                  Idle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('do_not_disturb')}>
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                  Do Not Disturb
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('offline')}>
                  <div className="w-2 h-2 rounded-full bg-gray-400 mr-2"></div>
                  Offline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Badge variant="outline" className="text-xs">
              {getTotalOnline()}/{getTotalMembers()} online
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(onlineUsers) as UserRole[]).map((role) => {
          const users = onlineUsers[role];
          if (users.length === 0) return null;

          const RoleIcon = roleIcons[role];
          const onlineCount = users.filter(u => u.status === 'online' || u.status === 'idle' || u.status === 'do_not_disturb').length;
          
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-4 h-4 rounded-full ${roleColors[role]} flex items-center justify-center`}>
                  <RoleIcon className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-sm font-medium capitalize">{role}s</span>
                <span className="text-xs text-muted-foreground">
                  ({onlineCount}/{users.length})
                </span>
              </div>
              
              <div className="space-y-1 ml-6">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 py-1 hover:bg-muted/50 rounded-md px-2 transition-colors">
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs font-medium">
                          {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background ${statusColors[user.status]} ${statusShapes[user.status]} flex items-center justify-center`}>
                        {user.status === 'do_not_disturb' && (
                          <div className="w-1.5 h-0.5 bg-white rounded-full"></div>
                        )}
                        {user.status === 'idle' && (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full border border-white"></div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name}</p>
                      {user.current_task_title ? (
                        <p className="text-xs text-muted-foreground truncate">
                          Working on: {user.current_task_title}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {user.status === 'online' ? 'Available' : 
                           user.status === 'idle' ? 'Idle' : 
                           user.status === 'do_not_disturb' ? 'Do Not Disturb' : 'Offline'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function OnlinePresence({ organizationId }: OnlinePresenceProps) {
  const [setUserOnline, setUserOffline] = useState<{
    setUserOnline: () => Promise<void>;
    setUserOffline: () => Promise<void>;
  } | null>(null);

  const handleSetUserOnline = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          status: 'online',
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  };

  const handleSetUserOffline = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          status: 'offline',
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  };

  return (
    <PresenceProvider 
      setUserOnline={handleSetUserOnline}
      setUserOffline={handleSetUserOffline}
    >
      <OnlinePresenceComponent organizationId={organizationId} />
    </PresenceProvider>
  );
}