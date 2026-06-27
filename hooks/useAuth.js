'use client';

/**
 * hooks/useAuth.js — Hook de autenticación para Client Components del admin
 *
 * Retorna: { user, rol, nombre, email, authId, loading }
 *
 * - Lee la sesión con supabase.auth.getUser() al montar.
 * - Se suscribe a onAuthStateChange para detectar logout cruzado entre tabs.
 * - En SIGNED_OUT, redirige a /admin/login.
 * - El cliente Supabase usa el singleton de lib/supabase/client.js.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState({
    user:    null,
    rol:     null,
    nombre:  null,
    email:   null,
    authId:  null,
    loading: true,
  });

  const cargarUsuario = useCallback(async (authUser) => {
    if (!authUser) {
      setState({ user: null, rol: null, nombre: null, email: null, authId: null, loading: false });
      return;
    }

    const supabase = createClient();

    try {
      const { data: adminUser } = await supabase
        .from('usuarios_admin')
        .select('rol, nombre, email, estado')
        .eq('email', authUser.email)
        .single();

      if (!adminUser || adminUser.estado !== 'activo') {
        // Usuario no autorizado — forzar logout
        await supabase.auth.signOut();
        setState({ user: null, rol: null, nombre: null, email: null, authId: null, loading: false });
        router.push('/admin/login');
        return;
      }

      setState({
        user:    authUser,
        rol:     adminUser.rol,
        nombre:  adminUser.nombre,
        email:   adminUser.email,
        authId:  authUser.id,
        loading: false,
      });
    } catch (err) {
      console.error('[useAuth] Error cargando usuario admin:', err);
      setState({ user: null, rol: null, nombre: null, email: null, authId: null, loading: false });
    }
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Carga inicial
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) await cargarUsuario(user);
    }
    init();

    // Suscripción a cambios de sesión (logout cruzado entre tabs, expiración)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setState({ user: null, rol: null, nombre: null, email: null, authId: null, loading: false });
        router.push('/admin/login');
      } else if (event === 'SIGNED_IN' && session?.user) {
        await cargarUsuario(session.user);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token renovado — no necesita re-cargar usuarios_admin
        setState(prev => ({ ...prev, user: session.user, authId: session.user.id }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [cargarUsuario, router]);

  return state;
}
