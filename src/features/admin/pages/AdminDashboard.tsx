import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AdminSalons } from '../components/AdminSalons';
import { AdminBookings } from '../components/AdminBookings';
import { AdminQueues } from '../components/AdminQueues';
import { AdminServicesManager } from '../components/AdminServicesManager';

export default function AdminDashboard() {
  const { isAdmin, loading } = useAdminCheck();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ totalSalons: 0, todayBookings: 0, activeQueue: 0 });

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({ variant: 'destructive', title: 'Access Denied', description: 'Admin access required.' });
      navigate('/');
    }
  }, [isAdmin, loading, navigate, toast]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
      const [salons, bookings, queue] = await Promise.all([
        supabase.from('barbers').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_date', new Date().toISOString().split('T')[0]),
        supabase.from('queues').select('id', { count: 'exact', head: true }).eq('status', 'waiting'),
      ]);
      setStats({
        totalSalons: salons.count || 0,
        todayBookings: bookings.count || 0,
        activeQueue: queue.count || 0,
      });
    };
    fetchStats();
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border min-h-screen p-4 hidden md:block">
        <h2 className="text-xl font-bold text-foreground mb-6 font-display">MakeMyCut Admin</h2>
        <nav className="space-y-1 text-sm">
          <p className="text-muted-foreground px-3 py-2 text-xs uppercase tracking-wider">Management</p>
          <a href="#salons" className="block px-3 py-2 rounded-lg text-foreground hover:bg-muted">Salons</a>
          <a href="#bookings" className="block px-3 py-2 rounded-lg text-foreground hover:bg-muted">Bookings</a>
          <a href="#queue" className="block px-3 py-2 rounded-lg text-foreground hover:bg-muted">Queue</a>
          <a href="#services" className="block px-3 py-2 rounded-lg text-foreground hover:bg-muted">Services Manager</a>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>Home</Button>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate('/'); }}>Logout</Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Salons</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{stats.totalSalons}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Today's Bookings</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{stats.todayBookings}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Queue</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{stats.activeQueue}</p></CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="salons">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="salons">Salons</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
            </TabsList>
            <TabsContent value="salons"><AdminSalons /></TabsContent>
            <TabsContent value="bookings"><AdminBookings /></TabsContent>
            <TabsContent value="queue"><AdminQueues /></TabsContent>
            <TabsContent value="services"><AdminServicesManager /></TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
