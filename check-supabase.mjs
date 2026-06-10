import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lignywsyuimwnipopozl.supabase.co';
const supabaseKey = 'sb_publishable_S11IGrMyAzh37A3yNyo2tA_R36RVy4i'; // Publishable Key

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .limit(5);

    if (servicesError) {
      console.error('Error fetching from services table:', servicesError);
    } else {
      console.log('Services fetched successfully:', services);
    }

    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .limit(5);

    if (reportsError) {
      console.error('Error fetching from reports table:', reportsError);
    } else {
      console.log('Reports fetched successfully:', reports);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testConnection();
