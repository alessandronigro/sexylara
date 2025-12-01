import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/discover_service.dart';
import '../services/invite_service.dart';
import '../widgets/main_top_bar.dart';

class DiscoverContactsScreen extends ConsumerStatefulWidget {
  const DiscoverContactsScreen({super.key, this.initialTab});
  // ignore: unused_field
  final String? initialTab; // kept for legacy navigation, ignored now

  @override
  ConsumerState<DiscoverContactsScreen> createState() => _DiscoverContactsScreenState();
}

class _DiscoverContactsScreenState extends ConsumerState<DiscoverContactsScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  List<dynamic> _thrillers = [];
  Map<String, String> _activeFilters = {};

  @override
  void initState() {
    super.initState();
    _loadThrillers();
  }

  Future<void> _loadThrillers([String? query]) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final svc = discoverServiceForCurrent();
      final data = await svc.fetchThrillers(query: query, filters: _activeFilters);
      if (mounted) {
        setState(() {
          _thrillers = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _invite(dynamic thriller) async {
    final inviteService = ref.read(inviteServiceProvider);
    try {
      await inviteService.sendInvite(
        targetId: thriller['id'].toString(),
        targetType: thriller['type'] ?? 'user',
      );
      if (mounted) {
        setState(() {
          final idx = _thrillers.indexWhere((t) => t['id'] == thriller['id']);
          if (idx != -1) {
            _thrillers[idx]['status'] = 'invited';
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invito inviato')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore invito: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: const MainTopBar(active: MainTopBarSection.invite),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Cerca Thrillers',
                hintStyle: TextStyle(color: Colors.grey[500]),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                filled: true,
                fillColor: const Color(0xFF1E1E1E),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onSubmitted: _loadThrillers,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
            child: Row(
              children: [
                ActionChip(
                  avatar: const Icon(Icons.filter_list, size: 16, color: Colors.white),
                  label: const Text('Filtri', style: TextStyle(color: Colors.white)),
                  backgroundColor: _activeFilters.isNotEmpty ? Colors.pinkAccent : const Color(0xFF1E1E1E),
                  onPressed: _showFilterDialog,
                ),
                const SizedBox(width: 8),
                if (_activeFilters.isNotEmpty)
                  ActionChip(
                    avatar: const Icon(Icons.close, size: 16, color: Colors.white),
                    label: const Text('Reset', style: TextStyle(color: Colors.white)),
                    backgroundColor: Colors.grey[800],
                    onPressed: () {
                      setState(() {
                        _activeFilters.clear();
                      });
                      _loadThrillers(_searchController.text);
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
                : _error != null
                    ? Center(child: Text('Errore: $_error', style: const TextStyle(color: Colors.red)))
                    : _thrillers.isEmpty
                        ? const Center(child: Text('Nessun Thriller pubblico', style: TextStyle(color: Colors.grey)))
                        : RefreshIndicator(
                            onRefresh: () => _loadThrillers(_searchController.text.trim().isEmpty ? null : _searchController.text.trim()),
                            color: Colors.pinkAccent,
                            child: ListView.builder(
                              itemCount: _thrillers.length,
                              itemBuilder: (context, index) {
                                final t = _thrillers[index];
                                final avatar = t['avatar'];
                                final type = (t['type'] ?? 'user') as String;
                                final status = (t['status'] ?? 'invite') as String;
                                final subtitle = type == 'npc' ? 'Thriller (NPC)' : 'Thriller (Utente)';
                                final statusData = _buildStatus(status);
                                return ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: Colors.grey[800],
                                    backgroundImage: avatar != null ? NetworkImage(avatar) : null,
                                    child: avatar == null
                                        ? Icon(
                                            type == 'npc' ? Icons.smart_toy : Icons.person,
                                            color: Colors.white,
                                          )
                                        : null,
                                  ),
                                  title: Text(t['name'] ?? 'Thriller', style: const TextStyle(color: Colors.white)),
                                  subtitle: Text(subtitle, style: const TextStyle(color: Colors.grey)),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(statusData.icon, color: statusData.color, size: 18),
                                          const SizedBox(width: 6),
                                          Text(
                                            statusData.label,
                                            style: TextStyle(color: statusData.color, fontSize: 12),
                                          ),
                                        ],
                                      ),
                                      if (status == 'invite')
                                        TextButton.icon(
                                          onPressed: () => _invite(t),
                                          icon: const Icon(Icons.person_add_alt, size: 16, color: Colors.pinkAccent),
                                          label: const Text('Invita', style: TextStyle(color: Colors.pinkAccent)),
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
  void _showFilterDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _FilterSheet(
        initialFilters: _activeFilters,
        onApply: (filters) {
          setState(() {
            _activeFilters = filters;
          });
          _loadThrillers(_searchController.text);
        },
      ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  final Map<String, String> initialFilters;
  final ValueChanged<Map<String, String>> onApply;

  const _FilterSheet({required this.initialFilters, required this.onApply});

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late Map<String, String> _filters;

  final _genders = ['female', 'male', 'non-binary'];
  final _ethnicities = ['latina', 'asian', 'european', 'african', 'mixed', 'other'];
  final _hairColors = ['black', 'brown', 'blonde', 'red', 'white', 'other'];
  final _eyeColors = ['brown', 'blue', 'green', 'hazel', 'grey', 'other'];

  @override
  void initState() {
    super.initState();
    _filters = Map.from(widget.initialFilters);
  }

  Widget _buildDropdown(String label, String key, List<String> options) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _filters[key],
            dropdownColor: const Color(0xFF2C2C2C),
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFF2C2C2C),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
            ),
            style: const TextStyle(color: Colors.white),
            items: [
              const DropdownMenuItem(value: null, child: Text('Qualsiasi', style: TextStyle(color: Colors.white54))),
              ...options.map((opt) => DropdownMenuItem(
                    value: opt,
                    child: Text(opt, style: const TextStyle(color: Colors.white)),
                  ))
            ],
            onChanged: (val) {
              setState(() {
                if (val == null) {
                  _filters.remove(key);
                } else {
                  _filters[key] = val;
                }
              });
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Filtra Thrillers', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          _buildDropdown('Genere', 'gender', _genders),
          _buildDropdown('Etnia', 'ethnicity', _ethnicities),
          _buildDropdown('Colore Capelli', 'hair_color', _hairColors),
          _buildDropdown('Colore Occhi', 'eye_color', _eyeColors),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                widget.onApply(_filters);
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.pinkAccent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('Applica Filtri'),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _StatusInfo {
  final String label;
  final Color color;
  final IconData icon;
  const _StatusInfo(this.label, this.color, this.icon);
}

_StatusInfo _buildStatus(String status) {
  switch (status) {
    case 'invited':
      return const _StatusInfo('Thriller inviato', Colors.amber, Icons.hourglass_top);
    case 'accepted':
      return const _StatusInfo('Thriller ha accettato', Colors.greenAccent, Icons.check_circle);
    default:
      return const _StatusInfo('Thriller da invitare', Colors.white70, Icons.person_add_alt);
  }
}
