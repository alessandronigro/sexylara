import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/npc.dart';

class NpcAvatar extends StatelessWidget {
  final Npc? npc;
  final String? avatarUrl;
  final String? name;
  final double radius;
  final bool showOnlineIndicator;

  const NpcAvatar({
    super.key,
    this.npc,
    this.avatarUrl,
    this.name,
    this.radius = 24,
    this.showOnlineIndicator = false,
  });

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl ?? npc?.avatarUrl;
    final rawName = name ?? npc?.name;
    final displayName = (rawName == null || rawName.trim().isEmpty) ? '?' : rawName;

    return Stack(
      children: [
        CircleAvatar(
          radius: radius,
          backgroundColor: Colors.pinkAccent,
          backgroundImage: url != null ? CachedNetworkImageProvider(url) : null,
          child: url == null
              ? Text(
                  displayName[0].toUpperCase(),
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: radius * 0.8,
                    fontWeight: FontWeight.bold,
                  ),
                )
              : null,
        ),
        if (showOnlineIndicator)
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: radius * 0.4,
              height: radius * 0.4,
              decoration: BoxDecoration(
                color: Colors.green,
                shape: BoxShape.circle,
                border: Border.all(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  width: 2,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
