import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/user_service.dart';
import '../services/ai_contact_service.dart';

class PrivacySettingsScreen extends ConsumerStatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  ConsumerState<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends ConsumerState<PrivacySettingsScreen> {
  bool _isUserPublic = false;
  List<AiContact> _myNpcs = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final userService = ref.read(userServiceProvider);
      final aiService = ref.read(aiContactServiceProvider);
      
      // Fetch user profile
      final profile = await userService.fetchUserProfile();
      final isPublic = profile['is_public'] ?? false;
      
      // Fetch NPCs
      final npcs = await aiService.fetchAiContacts();
      
      if (mounted) {
        setState(() {
          _isUserPublic = isPublic;
          _myNpcs = npcs.where((n) => n.isOwned).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _toggleUserPrivacy(bool value) async {
    try {
      final userService = ref.read(userServiceProvider);
      await userService.updateUserPrivacy(value);
      setState(() => _isUserPublic = value);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _toggleNpcPrivacy(AiContact npc, bool value) async {
    try {
      final userService = ref.read(userServiceProvider);
      await userService.updateNpcPrivacy(npc.id, value);
      
      setState(() {
        final index = _myNpcs.indexWhere((n) => n.id == npc.id);
        if (index != -1) {
          // Create new object with updated status (AiContact might be immutable, so careful)
          // Assuming we can just reload or update local list if AiContact has copyWith or similar.
          // If not, we just reload list.
          _loadSettings(); 
        }
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Privacy Settings'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Profilo Utente',
                  style: TextStyle(color: Colors.pinkAccent, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: const Text('Profilo Pubblico', style: TextStyle(color: Colors.white)),
                  subtitle: const Text(
                    'Permetti ad altri utenti di trovarti e invitarti nei gruppi.',
                    style: TextStyle(color: Colors.grey),
                  ),
                  value: _isUserPublic,
                  onChanged: _toggleUserPrivacy,
                  activeColor: Colors.pinkAccent,
                ),
                const Divider(color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'I tuoi NPC',
                  style: TextStyle(color: Colors.pinkAccent, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                if (_myNpcs.isEmpty)
                  const Text('Nessun NPC creato.', style: TextStyle(color: Colors.grey)),
                ..._myNpcs.map((npc) {
                  return SwitchListTile(
                    title: Text(npc.name, style: const TextStyle(color: Colors.white)),
                    subtitle: Text(
                      npc.isPublic ? 'Pubblico (visibile a tutti)' : 'Privato (solo tu)',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                    secondary: CircleAvatar(
                      backgroundImage: npc.avatar != null ? NetworkImage(npc.avatar!) : null,
                      child: npc.avatar == null ? Text(npc.name[0]) : null,
                    ),
                    value: npc.isPublic,
                    onChanged: (val) => _toggleNpcPrivacy(npc, val),
                    activeColor: Colors.pinkAccent,
                  );
                }),
              ],
            ),
    );
  }
}
