import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/invite_service.dart';
import '../services/supabase_service.dart';

enum MainTopBarSection { thrillers, feed, groups, invite, invited, profile }

class MainTopBar extends ConsumerStatefulWidget implements PreferredSizeWidget {
  final MainTopBarSection active;
  const MainTopBar({super.key, this.active = MainTopBarSection.thrillers});

  @override
  ConsumerState<MainTopBar> createState() => _MainTopBarState();
  
  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class _MainTopBarState extends ConsumerState<MainTopBar> {
  int _pendingInvitesCount = 0;
  String? _userAvatarUrl;
  String? _userName;

  @override
  void initState() {
    super.initState();
    _loadPendingInvitesCount();
    _loadUserProfile();
  }

  Future<void> _loadUserProfile() async {
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return;
      
      final response = await SupabaseService.client
          .from('user_profile')
          .select('avatar_url, username')
          .eq('id', userId)
          .maybeSingle();
      
      if (mounted && response != null) {
        setState(() {
          _userAvatarUrl = response['avatar_url'];
          _userName = response['username'];
        });
      }
    } catch (e) {
      // Ignore errors silently
    }
  }

  Future<void> _loadPendingInvitesCount() async {
    try {
      final inviteService = ref.read(inviteServiceProvider);
      final invites = await inviteService.fetchPendingInvites();
      if (mounted) {
        setState(() {
          _pendingInvitesCount = invites.length;
        });
      }
    } catch (e) {
      // Ignore errors silently
    }
  }

  bool _isActive(MainTopBarSection section) => section == widget.active;

  List<_NavItem> _navItems(BuildContext context) => [
        _NavItem(
          section: MainTopBarSection.thrillers,
          icon: Icons.favorite,
          label: 'I miei Thriller',
          onTap: () => context.go('/'),
          badgeCount: _pendingInvitesCount,
        ),
        _NavItem(
          section: MainTopBarSection.feed,
          icon: Icons.public,
          label: 'Feed',
          onTap: () => context.go('/feed'),
        ),
        _NavItem(
          section: MainTopBarSection.groups,
          icon: Icons.groups,
          label: 'I miei gruppi',
          onTap: () => context.go('/groups'),
        ),
        _NavItem(
          section: MainTopBarSection.invite,
          icon: Icons.add_circle_outline,
          label: 'Aggiungi Thriller',
          onTap: () => context.push('/create-npc'),
        ),
        _NavItem(
          section: MainTopBarSection.invited,
          icon: Icons.person_add_alt,
          label: 'Invita Thriller',
          onTap: () => context.push('/discover-contacts'),
        ),
        _NavItem(
          section: MainTopBarSection.profile,
          icon: Icons.person,
          label: 'Profilo',
          onTap: () => context.push('/user-profile'),
          showAvatar: true,
          avatarUrl: _userAvatarUrl,
          userName: _userName,
        ),
      ];

  void _openMenu(BuildContext context) {
    final items = _navItems(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[700],
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              // User profile at top of menu
              if (_userAvatarUrl != null || _userName != null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundImage: _userAvatarUrl != null ? NetworkImage(_userAvatarUrl!) : null,
                        child: _userAvatarUrl == null ? const Icon(Icons.person) : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _userName ?? 'Utente',
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              const Divider(color: Colors.white24),
              ...items.map((item) => ListTile(
                    leading: Icon(item.icon,
                        color: _isActive(item.section)
                            ? Colors.pinkAccent
                            : Colors.white70),
                    title: Text(
                      item.label,
                      style: TextStyle(
                        color: _isActive(item.section)
                            ? Colors.pinkAccent
                            : Colors.white,
                        fontWeight: _isActive(item.section)
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                    ),
                    onTap: () {
                      Navigator.of(context).pop();
                      item.onTap();
                    },
                  )),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.of(context).size.width < 640;
    final items = _navItems(context);
    return AppBar(
      backgroundColor: const Color(0xFF1A1A1A),
      titleSpacing: 0,
      leadingWidth: isCompact ? 140 : 170,
      leading: InkWell(
        onTap: () => context.go('/'),
        child: Row(
          children: [
            const SizedBox(width: 12),
            Image.asset('assets/icon.png', height: isCompact ? 34 : 38),
            if (!isCompact) ...[
              const SizedBox(width: 8),
              const Text(
                'ThrilMe',
                style:
                    TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ],
          ],
        ),
      ),
      actions: isCompact
          ? [
              IconButton(
                icon: const Icon(Icons.menu, color: Colors.white),
                onPressed: () => _openMenu(context),
              ),
              const SizedBox(width: 4),
            ]
          : [
              ...items.map((item) => item.showAvatar && item.section == MainTopBarSection.profile
                  ? _AvatarButton(
                      avatarUrl: item.avatarUrl,
                      userName: item.userName,
                      onTap: item.onTap,
                    )
                  : _NavButton(
                      icon: item.icon,
                      label: item.label,
                      active: _isActive(item.section),
                      onTap: item.onTap,
                      badgeCount: item.badgeCount,
                    )),
              const SizedBox(width: 8),
            ],
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final int badgeCount;

  const _NavButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? Colors.pinkAccent : Colors.white70;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          TextButton.icon(
            onPressed: onTap,
            icon: Icon(icon, size: 18, color: color),
            label: Text(
              label,
              style: TextStyle(color: color, fontSize: 13),
            ),
            style: TextButton.styleFrom(
              foregroundColor: color,
              backgroundColor:
                  active ? Colors.pinkAccent.withOpacity(0.12) : Colors.transparent,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          if (badgeCount > 0)
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(10),
                ),
                constraints: const BoxConstraints(
                  minWidth: 18,
                  minHeight: 18,
                ),
                child: Text(
                  badgeCount > 99 ? '99+' : badgeCount.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _NavItem {
  final MainTopBarSection section;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badgeCount;
  final bool showAvatar;
  final String? avatarUrl;
  final String? userName;
  _NavItem({
    required this.section,
    required this.icon,
    required this.label,
    required this.onTap,
    this.badgeCount = 0,
    this.showAvatar = false,
    this.avatarUrl,
    this.userName,
  });
}

class _AvatarButton extends StatelessWidget {
  final String? avatarUrl;
  final String? userName;
  final VoidCallback onTap;

  const _AvatarButton({
    this.avatarUrl,
    this.userName,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: CircleAvatar(
            radius: 18,
            backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
            child: avatarUrl == null ? const Icon(Icons.person, size: 20) : null,
          ),
        ),
      ),
    );
  }
}
