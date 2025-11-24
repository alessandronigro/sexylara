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
    try {
      final groupService = ref.read(groupServiceProvider);
      
      final result = await groupService.inviteNpc(
        groupId: widget.groupId,
        npcId: contact.id,
      );

      if (mounted) {
        final status = result['status'];
        final reason = result['reason'];
        
        String msg = '';
        if (status == 'accepted') {
          msg = '${contact.name} joined the group!';
        } else if (status == 'pending_approval') {
          msg = 'Invite sent to owner for approval.';
        } else if (status == 'rejected') {
          msg = '${contact.name} declined: $reason';
        } else {
          msg = 'Invite status: $status';
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
        
        if (status == 'accepted' || status == 'pending_approval') {
           // Optional: remove from list or mark as invited
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error inviting: $e')),
        );
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
            onPressed: () => _invite(ai),
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: const Text('Invite'),
          ),
        );
      },
    );
  }
}
