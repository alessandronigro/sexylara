import 'package:flutter/material.dart';
import '../models/pending_media.dart';

class PendingMediaBubble extends StatelessWidget {
  final PendingMedia media;

  const PendingMediaBubble(this.media, {super.key});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.grey.shade900,
          borderRadius: BorderRadius.circular(12),
        ),
        width: 180,
        height: 180,
        child: _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    if (media.status == 'failed') {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.error, color: Colors.red),
          SizedBox(height: 8),
          Text("Failed to generate", style: TextStyle(color: Colors.red)),
        ],
      );
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(
          width: 40,
          height: 40,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
        const SizedBox(height: 10),
        Text(
          _loadingLabel(),
          style: const TextStyle(color: Colors.white70),
        )
      ],
    );
  }

  String _loadingLabel() {
    switch (media.mediaType) {
      case 'image':
        return 'Generating image…';
      case 'video':
        return 'Generating video…';
      case 'audio':
        return 'Generating audio…';
      default:
        return 'Generating…';
    }
  }
}
