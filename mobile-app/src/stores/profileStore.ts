import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface BodyweightEntry { date: string; kg: number }
export interface TrainerInfo { id: string; full_name: string | null; email: string | null; avatar_url: string | null; bio: string | null }

export const useProfileStore = defineStore('profile', () => {
  const bodyweightLog = ref<BodyweightEntry[]>([])
  const trainer       = ref<TrainerInfo | null>(null)

  async function fetchBodyweightLog(userId: string) {
    // Stored in Supabase directly — not in RxDB (not offline-critical)
    const { data } = await supabase
      .from('bodyweight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(90)
    if (data) bodyweightLog.value = data
  }

  async function logBodyweight(kg: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('bodyweight_logs').upsert({ user_id: user.id, date: today, kg }, { onConflict: 'user_id,date' })
    await fetchBodyweightLog(user.id)
  }

  async function fetchTrainerAssignment(userId: string) {
    const { data } = await supabase
      .from('trainer_assignments')
      .select('trainer_id, profiles!trainer_assignments_trainer_id_fkey(id, full_name, avatar_url, bio)')
      .eq('client_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.profiles) {
      const p = data.profiles as any
      trainer.value = { id: p.id, full_name: p.full_name, email: null, avatar_url: p.avatar_url ?? null, bio: p.bio ?? null }
    } else {
      trainer.value = null
    }
  }

  return { bodyweightLog, trainer, fetchBodyweightLog, logBodyweight, fetchTrainerAssignment }
})
