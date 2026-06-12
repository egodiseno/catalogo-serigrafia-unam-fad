// Debug temporal para ver estructura real de datos

const SUPABASE_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugWorks() {
  // Get 1 obra completa
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .eq('estado', 'publicado')
    .limit(1)
    .single();

  console.log('🔍 OBRA RAW:', data);
  console.log('❌ Error (si hay):', error);

  // Get obra con relaciones
  const { data: workWithRelations, error: err2 } = await supabase
    .from('obras')
    .select(`
      id,
      titulo,
      slug,
      artista,
      año,
      tecnica_id,
      estado
    `)
    .eq('estado', 'publicado')
    .limit(1)
    .single();

  console.log('🔍 OBRA CON SELECT:', workWithRelations);
  console.log('❌ Error:', err2);
}

// Ejecutar cuando cargue
window.addEventListener('load', debugWorks);
