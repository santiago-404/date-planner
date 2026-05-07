import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Group = {
  id: string;
  name: string;
  invite_code: string;
};

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('group_members')
      .select('groups(id, name, invite_code)')
      .eq('user_id', user.id);

    if (data) {
      setGroups(data.map((row: any) => row.groups).filter(Boolean));
    }
    setLoading(false);
  };

  // Reload whenever this tab comes back into focus
  useFocusEffect(useCallback(() => { loadGroups(); }, []));

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setActionLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: newGroupName.trim(), created_by: user.id })
      .select()
      .single();

    if (error || !group) {
      Alert.alert('Error', 'Could not create group.');
      setActionLoading(false);
      return;
    }

    // Add the creator as first member
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      display_name: user.user_metadata?.display_name ?? user.email,
    });

    setActionLoading(false);
    setShowCreate(false);
    setNewGroupName('');
    loadGroups();
  };

  const joinGroup = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setActionLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', code)
      .single();

    if (!group) {
      Alert.alert('Invalid code', 'No group found with that code. Double-check and try again.');
      setActionLoading(false);
      return;
    }

    const { error } = await supabase.from('group_members').upsert(
      {
        group_id: group.id,
        user_id: user.id,
        display_name: user.user_metadata?.display_name ?? user.email,
      },
      { onConflict: 'group_id,user_id' }
    );

    if (error) {
      Alert.alert('Error', error.message);
      setActionLoading(false);
      return;
    }

    setActionLoading(false);
    setShowJoin(false);
    setInviteCode('');
    loadGroups();
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Groups</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#FF5A5F" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={() => (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No groups yet.</Text>
              <Text style={styles.emptySubtext}>Create one or enter an invite code.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.groupCard}
              onPress={() => router.push(`/group/${item.id}`)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.inviteCode}>Code: {item.invite_code}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Sticky bottom actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.primaryBtnText}>+ Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowJoin(true)}>
          <Text style={styles.outlineBtnText}>Enter Code</Text>
        </TouchableOpacity>
      </View>

      {/* CREATE MODAL */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name (e.g. Saturday Crew)"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createGroup}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={createGroup} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Create</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* JOIN MODAL */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Join a Group</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="e.g. A3F9BC12"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={joinGroup}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={joinGroup} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Join</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowJoin(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A' },
  signOutText: { color: '#AAA', fontSize: 14 },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#AAA' },
  groupCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 25,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupName: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  inviteCode: { fontSize: 12, color: '#AAA', marginTop: 3, letterSpacing: 1 },
  arrow: { fontSize: 26, color: '#CCC' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#FF5A5F',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  outlineBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FF5A5F',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#FF5A5F', fontWeight: 'bold', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    paddingBottom: 50,
  },
  sheetTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#1A1A1A' },
  input: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#FF5A5F', fontWeight: '600', fontSize: 15 },
});
