import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cpdmsavegcwijwxbqxqs.supabase.co'
const supabaseAnonKey = 'sb_publishable_zrQNgYfiavdDA4Fq-VtRXw_iZMK1ujT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
