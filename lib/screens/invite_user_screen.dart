import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/group_service.dart';
import '../services/user_service.dart';

class InviteUserScreen extends ConsumerStatefulWidget {
  final String groupId;
  final String groupName;

  const InviteUserScreen({
    super.key,
    required this.groupId,
    required this.groupName,
  });

  @override
  ConsumerState<InviteUserScreen> createState() => _InviteUserScreenState();
}

class _InviteUserScreenState extends ConsumerState<InviteUserScreen> {
  final _searchController = TextEditingController();
  List<dynamic> _users = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers([String? query]) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final userService = ref.read(userServiceProvider);
      final users = await userService.fetchPublicUsers(query: query);
      if (mounted) {
        setState(() {
          _users = users;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _inviteUser(String userId, String userName) async {
    try {
      final groupService = ref.read(groupServiceProvider);
      await groupService.inviteUser(
        groupId: widget.groupId,
        receiverId: userId,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invite sent to $userName!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: Text('Invite to ${widget.groupName}'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Search Users',
                labelStyle: TextStyle(color: Colors.grey[400]),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                filled: true,
                fillColor: const Color(0xFF1E1E1E),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onSubmitted: _loadUsers,
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
                : _error != null
                    ? Center(child: Text('Error: $_error', style: const TextStyle(color: Colors.red)))
                    : _users.isEmpty
                        ? Center(
                            child: Text(
                              'No public users found.',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                          )
                        : ListView.builder(
                            itemCount: _users.length,
                            itemBuilder: (context, index) {
                              final user = _users[index];
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: Colors.grey[800],
                                  backgroundImage: user['avatar'] != null
                                      ? NetworkImage(user['avatar'])
                                      : null,
                                  child: user['avatar'] == null
                                      ? const Icon(Icons.person, color: Colors.white)
                                      : null,
                                ),
                                title: Text(
                                  user['name'] ?? 'Unknown',
                                  style: const TextStyle(color: Colors.white),
                                ),
                                trailing: ElevatedButton(
                                  onPressed: () => _inviteUser(user['id'], user['name']),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.pinkAccent,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                  ),
                                  child: const Text('Invite'),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
