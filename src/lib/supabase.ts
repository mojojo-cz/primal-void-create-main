import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少必需的Supabase环境变量: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey) 