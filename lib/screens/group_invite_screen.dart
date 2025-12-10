import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/ai_contact_service.dart';
import '../services/group_service.dart';

class GroupInviteScreen extends ConsumerStatefulWidget {
  final String groupId;
  final String groupName;

  const GroupInviteScreen({
    super.key,
    required this.groupId,
    required this.groupName,
  });

  @override
  ConsumerState<GroupInviteScreen> createState() => _GroupInviteScreenState();
}

class _GroupInviteScreenState extends ConsumerState<GroupInviteScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<AiContact> _myAi = [];
  List<AiContact> _publicAi = [];
  bool _isLoading = true;
  final Set<String> _invitingIds = {};
  final Set<String> _invitedIds = {};
  final Set<String> _pendingIds = {}; // Track pending invites (yellow)

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final service = ref.read(aiContactServiceProvider);
      
      // Load all contacts (owned + public)
      final allContacts = await service.fetchAiContacts();
      
      // Separate them
      setState(() {
        _myAi = allContacts.where((ai) => ai.isOwned).toList();
        _publicAi = allContacts.where((ai) => !ai.isOwned && ai.isPublic).toList();
        _isLoading = false;
        // Don't clear _invitedIds - keep track of who we've invited this session
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading contacts: $e')),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _invite(AiContact contact) async {
    if (_invitingIds.contains(contact.id) || _invitedIds.contains(contact.id)) return;
    
    setState(() {
      _invitingIds.add(contact.id);
    });
    
    try {
      final groupService = ref.read(groupServiceProvider);
      final result = await groupService.inviteNpc(
        groupId: widget.groupId,
        npcId: contact.id,
      );

      if (!mounted) return;

      // Service now returns {success: true/false, ...} instead of throwing
      final success = result['success'] == true;
      final added = result['added'];
      final npcName = result['npcName'] ?? contact.name;
      final error = result['error'];
      final code = result['code'];
      
      // DEBUG: Print the actual response
      print('DEBUG invite response: $result');
      print('DEBUG success=$success, code=$code, error=$error');
      
      String msg = '';
      bool markAsInvited = false;
      bool isPending = false;
      
      if (success && added == 'npc') {
        // NPC successfully added to group (immediate)
        msg = '$npcName joined the group!';
        markAsInvited = true;
        isPending = false;
      } else if (code == 'NPC_ALREADY_MEMBER') {
        // NPC is already in the group
        msg = '$npcName is already in the group';
        markAsInvited = true;
        isPending = false;
      } else if (code == 'INVITE_ALREADY_PENDING') {
        // Invite already sent and pending
        msg = 'Invite already pending for $npcName';
        markAsInvited = true;
        isPending = true;
      } else if (success) {
        // Generic success (e.g., user invite sent)
        msg = 'Invite sent to $npcName!';
        markAsInvited = true;
        isPending = true;
      } else {
        msg = error ?? 'Failed to invite $npcName';
      }

      if (markAsInvited) {
        print('DEBUG: Marking ${contact.id} as invited (pending=$isPending)');
        setState(() {
          _invitedIds.add(contact.id);
          if (isPending) {
            _pendingIds.add(contact.id);
          }
        });
        print('DEBUG: _invitedIds now contains: $_invitedIds');
        print('DEBUG: _pendingIds now contains: $_pendingIds');
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error inviting: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _invitingIds.remove(contact.id);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Invite to ${widget.groupName}'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'My AI'),
            Tab(text: 'Public AI'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildList(_myAi),
                _buildList(_publicAi),
              ],
            ),
    );
  }

  Widget _buildList(List<AiContact> contacts) {
    if (contacts.isEmpty) {
      return const Center(child: Text('No contacts found.'));
    }

    return ListView.builder(
      itemCount: contacts.length,
      itemBuilder: (context, index) {
        final ai = contacts[index];
        return ListTile(
          key: ValueKey('${ai.id}_${_invitedIds.contains(ai.id)}_${_invitingIds.contains(ai.id)}_${_pendingIds.contains(ai.id)}'),
          leading: CircleAvatar(
            backgroundImage: ai.avatar != null ? NetworkImage(ai.avatar!) : null,
            child: ai.avatar == null ? Text(ai.name[0]) : null,
          ),
          title: Text(ai.name),
          subtitle: Text(
            '${ai.personality ?? 'Unknown'} • ${ai.rating > 0 ? '⭐ ${ai.rating.toStringAsFixed(1)}' : 'New'}',
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
          ),
          trailing: ElevatedButton(
            onPressed: (_invitingIds.contains(ai.id) || _invitedIds.contains(ai.id))
                ? null
                : () => _invite(ai),
            style: ElevatedButton.styleFrom(
              backgroundColor: _invitedIds.contains(ai.id)
                  ? (_pendingIds.contains(ai.id) ? Colors.orange : Colors.green)
                  : Theme.of(context).primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: Text(
              _invitedIds.contains(ai.id)
                  ? (_pendingIds.contains(ai.id) ? 'Pending' : 'Invited')
                  : (_invitingIds.contains(ai.id) ? 'Sending...' : 'Invite'),
            ),
          ),
        );
      },
    );
  }
}
