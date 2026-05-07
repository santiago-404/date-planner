import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { generatePlan } from '../../utils/planner';

type ParticipantInput = {
  id: string;
  user_id: string;
  available_date: string | null;
  time_slot: 'day' | 'night' | null;
  budget_contribution: number | null;
  preferred_area: string | null;
  updated_at: string;
  // joined from group_members
  display_name?: string;
};

type Group = {
  id: string;
  name: string;
  invite_code: string;
};

export default function GroupRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [inputs, setInputs] = useState<ParticipantInput[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMyUserId(user?.id ?? null);

      // Fetch group info
      const { data: groupData } = await supabase
        .from('groups')
        .select('id, name, invite_code')
        .eq('id', id)
        .single();
      setGroup(groupData);

      // Fetch existing inputs with display names
      await refreshInputs();
      setLoading(false);
    };

    const refreshInputs = async () => {
      // Fetch inputs then join display names manually (avoids complex foreign key setup)
      const { data: inputsData } = await supabase
        .from('participant_inputs')
        .select('*')
        .eq('group_id', id);

      if (!inputsData) return;

      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, display_name')
        .eq('group_id', id);

      const nameMap = Object.fromEntries(
        (members ?? []).map((m) => [m.user_id, m.display_name])
      );

      setInputs(
        inputsData.map((inp) => ({
          ...inp,
          display_name: nameMap[inp.user_id] ?? 'Someone',
        }))
      );
    };

    init();

    // ── Real-time subscription ──────────────────────────────────────────────
    channel = supabase
      .channel(`group-room:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participant_inputs',
          filter: `group_id=eq.${id}`,
        },
        async (payload) => {
          const updated = payload.new as ParticipantInput;

          // Fetch display name for this user
          const { data: member } = await supabase
            .from('group_members')
            .select('display_name')
            .eq('group_id', id)
            .eq('user_id', updated.user_id)
            .single();

          const enriched: ParticipantInput = {
            ...updated,
            display_name: member?.display_name ?? 'Someone',
          };

          setInputs((prev) => {
            const idx = prev.findIndex((p) => p.user_id === enriched.user_id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = enriched;
              return next;
            }
            return [...prev, enriched];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const shareInviteCode = async () => {
    if (!group) return;
    await Share.share({
      message: `Join my group "${group.name}" on Date Planner!\nCode: ${group.invite_code}`,
    });
  };

  const generateGroupPlan = () => {
    const ready = inputs.filter((i) => i.budget_contribution !== null);

    if (ready.length === 0) {
      Alert.alert(
        'No inputs yet',
        'Wait for at least one member to submit their availability.'
      );
      return;
    }

    // Aggregate constraints from all submitted inputs
    const totalBudget = ready.reduce((sum, i) => sum + (i.budget_contribution ?? 0), 0);

    // Pick the most-voted area
    const areaCounts = ready.reduce((acc, i) => {
      if (i.preferred_area) acc[i.preferred_area] = (acc[i.preferred_area] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const area = (
      Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'BGC'
    ) as any;

    // isNight = true if ANY member preferred night
    const isNight = ready.some((i) => i.time_slot === 'night');

    const result = generatePlan({ budget: totalBudget, area, isNight, lockedItems: [] });
    const meta = { budget: totalBudget, area, isNight };

    router.push({
      pathname: '/result',
      params: {
        data: JSON.stringify(result),
        meta: JSON.stringify(meta),
      },
    });
  };

  const myInput = inputs.find((i) => i.user_id === myUserId);
  const submittedCount = inputs.filter((i) => i.budget_contribution !== null).length;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FF5A5F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Group name */}
        <Text style={styles.title}>{group?.name}</Text>

        {/* Invite code card — tap to share */}
        <TouchableOpacity style={styles.codeCard} onPress={shareInviteCode} activeOpacity={0.7}>
          <View>
            <Text style={styles.codeLabel}>INVITE CODE</Text>
            <Text style={styles.codeValue}>{group?.invite_code}</Text>
          </View>
          <View style={styles.shareHint}>
            <Ionicons name="share-outline" size={20} color="#FF5A5F" />
            <Text style={styles.shareHintText}>Share</Text>
          </View>
        </TouchableOpacity>

        {/* Participants section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <Text style={styles.sectionCount}>
            {submittedCount}/{inputs.length} ready
          </Text>
        </View>

        {inputs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              You're the only one here so far.{'\n'}Share the code to invite others.
            </Text>
          </View>
        ) : (
          inputs.map((item) => (
            <View
              key={item.user_id}
              style={[styles.card, item.user_id === myUserId && styles.myCard]}
            >
              {/* Name + status badge */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>
                  {item.display_name ?? 'Anonymous'}
                  {item.user_id === myUserId ? '  (You)' : ''}
                </Text>
                {item.budget_contribution !== null ? (
                  <View style={styles.readyBadge}>
                    <Text style={styles.readyText}>✓ Ready</Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                )}
              </View>

              {/* Submitted details */}
              {item.budget_contribution !== null && (
                <View style={styles.cardDetails}>
                  <Text style={styles.detailRow}>
                    📅  {item.available_date ?? 'Any day'}
                    {'   '}
                    {item.time_slot === 'night' ? '🌙 Night' : '☀️ Day'}
                  </Text>
                  <Text style={styles.detailRow}>📍  {item.preferred_area}</Text>
                  <Text style={styles.detailRow}>₱  {item.budget_contribution}</Text>
                </View>
              )}
            </View>
          ))
        )}

        {/* Budget summary (if anyone has submitted) */}
        {submittedCount > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Combined budget</Text>
            <Text style={styles.summaryValue}>
              ₱{inputs
                .filter((i) => i.budget_contribution !== null)
                .reduce((s, i) => s + (i.budget_contribution ?? 0), 0)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.availBtn}
          onPress={() => router.push(`/group/submit/${id}`)}
        >
          <Text style={styles.availBtnText}>
            {myInput?.budget_contribution != null
              ? 'Edit My Availability'
              : 'Submit My Availability'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.generateBtn, submittedCount === 0 && styles.disabledBtn]}
          onPress={generateGroupPlan}
          disabled={submittedCount === 0}
        >
          <Text style={styles.generateBtnText}>Generate Group Plan ✨</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 25, paddingTop: 20, paddingBottom: 180 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 18 },

  codeCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#FFDDDE',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF5A5F',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  codeValue: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', letterSpacing: 4 },
  shareHint: { alignItems: 'center', gap: 4 },
  shareHintText: { fontSize: 11, color: '#FF5A5F', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#444' },
  sectionCount: { fontSize: 13, color: '#AAA' },

  emptyBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: '#AAA', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  myCard: { borderWidth: 2, borderColor: '#FF5A5F' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  readyBadge: {
    backgroundColor: '#E8F8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  readyText: { color: '#27AE60', fontSize: 11, fontWeight: '700' },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pendingText: { color: '#F39C12', fontSize: 11, fontWeight: '700' },
  cardDetails: { marginTop: 12, gap: 5 },
  detailRow: { fontSize: 13, color: '#555' },

  summaryCard: {
    marginTop: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { color: '#AAA', fontSize: 13 },
  summaryValue: { color: 'white', fontSize: 20, fontWeight: 'bold' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 36,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  availBtn: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  availBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  generateBtn: {
    backgroundColor: '#FF5A5F',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
  },
  generateBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  disabledBtn: { opacity: 0.35 },
});
