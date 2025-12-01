import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_player/video_player.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:intl/intl.dart';

// IMPORT CORRETTO DEL MODEL
import 'package:thrilme/models/message.dart';

/// Unified message bubble for both 1-to-1 and group chats
/// Supports: text, images, videos, audio
/// Features: avatar, sender name, timestamps, media preview
class UnifiedMessageBubble extends StatelessWidget {
  final String content;
  final MessageType type;
  final bool isMe;
  final DateTime? timestamp;
  
  // For group chat
  final String? senderName;
  final String? avatarUrl;
  final VoidCallback? onAvatarTap;
  
  // For media
  final String? mediaUrl;

  const UnifiedMessageBubble({
    super.key,
    required this.content,
    this.type = MessageType.text,
    required this.isMe,
    this.timestamp,
    this.senderName,
    this.avatarUrl,
    this.onAvatarTap,
    this.mediaUrl,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          // Avatar (only for non-user messages with avatar)
          if (!isMe && avatarUrl != null) ...[
            GestureDetector(
              onTap: onAvatarTap,
              child: CircleAvatar(
                radius: 18,
                backgroundColor: Colors.grey[800],
                backgroundImage: avatarUrl!.startsWith('http')
                    ? NetworkImage(avatarUrl!)
                    : null,
                onBackgroundImageError: (_, __) {},
                ),
            ),
            const SizedBox(width: 8),
          ],

          // Message bubble
          Flexible(
            child: Column(
              crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                // Sender name (only for group chat, non-user messages)
                if (!isMe && senderName != null && senderName!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 4),
                    child: Text(
                      senderName!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[400],
                      ),
                    ),
                  ),

                // Bubble container
                Container(
                  padding: _getPadding(),
                  decoration: _getDecoration(),
                  child: _buildContent(context),
                ),

                // Timestamp
                if (timestamp != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, left: 12, right: 12),
                    child: Text(
                      _formatTime(timestamp!),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey[500],
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Spacing for user messages
          if (isMe && avatarUrl != null) const SizedBox(width: 26),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    switch (type) {
      case MessageType.text:
        return Text(
          content,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            height: 1.4,
          ),
        );
      case MessageType.image:
        return _ImageMessage(url: mediaUrl ?? content);
      case MessageType.video:
        return _VideoMessage(url: mediaUrl ?? content);
      case MessageType.audio:
        return _AudioMessage(url: mediaUrl ?? content);
      default:
        return Text(content, style: const TextStyle(color: Colors.white));
    }
  }

  EdgeInsets _getPadding() {
    return (type == MessageType.image || type == MessageType.video)
        ? const EdgeInsets.all(4)
        : const EdgeInsets.symmetric(horizontal: 14, vertical: 10);
  }

  BoxDecoration _getDecoration() {
    return BoxDecoration(
      color: isMe ? const Color(0xFFE91E63) : const Color(0xFF2A2A2A),
      borderRadius: BorderRadius.only(
        topLeft: const Radius.circular(18),
        topRight: const Radius.circular(18),
        bottomLeft: Radius.circular(isMe ? 18 : 4),
        bottomRight: Radius.circular(isMe ? 4 : 18),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.1),
          blurRadius: 4,
          offset: const Offset(0, 2),
        ),
      ],
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inMinutes < 1) return 'Ora';
    if (diff.inHours < 1) return '${diff.inMinutes}m fa';
    if (diff.inDays < 1) return '${diff.inHours}h fa';
    return '${time.day}/${time.month}';
  }
}



// Image message widget
class _ImageMessage extends StatelessWidget {
  final String url;

  const _ImageMessage({required this.url});

  @override
  Widget build(BuildContext context) {
    final isLocal = !url.startsWith('http');
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => _FullScreenImage(imageUrl: url),
          ),
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: isLocal
            ? Image.file(
                File(url),
                width: 200,
                fit: BoxFit.cover,
              )
            : CachedNetworkImage(
                imageUrl: url,
                width: 200,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  width: 200,
                  height: 200,
                  color: Colors.black12,
                  child: const Center(
                    child: CircularProgressIndicator(
                      color: Colors.pinkAccent,
                      strokeWidth: 2,
                    ),
                  ),
                ),
                errorWidget: (context, url, error) => Container(
                  width: 200,
                  height: 150,
                  color: Colors.grey[800],
                  child: const Center(
                    child: Icon(Icons.broken_image, color: Colors.white54),
                  ),
                ),
              ),
      ),
    );
  }
}

// Full screen image viewer
class _FullScreenImage extends StatelessWidget {
  final String imageUrl;

  const _FullScreenImage({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Center(
        child: InteractiveViewer(
          child: imageUrl.startsWith('http')
              ? CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.contain,
                )
              : Image.file(File(imageUrl), fit: BoxFit.contain),
        ),
      ),
    );
  }
}

// Video message widget
class _VideoMessage extends StatefulWidget {
  final String url;

  const _VideoMessage({required this.url});

  @override
  State<_VideoMessage> createState() => _VideoMessageState();
}

class _VideoMessageState extends State<_VideoMessage> {
  late VideoPlayerController _controller;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _controller = widget.url.startsWith('http')
        ? VideoPlayerController.networkUrl(Uri.parse(widget.url))
        : VideoPlayerController.file(File(widget.url));
    _controller.initialize().then((_) {
      if (mounted) setState(() => _isInitialized = true);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return Container(
        width: 200,
        height: 150,
        color: Colors.black12,
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    return GestureDetector(
      onTap: () {
        setState(() {
          _controller.value.isPlaying ? _controller.pause() : _controller.play();
        });
      },
      child: SizedBox(
        width: 200,
        height: 150,
        child: Stack(
          alignment: Alignment.center,
          children: [
            VideoPlayer(_controller),
            if (!_controller.value.isPlaying)
              const Icon(Icons.play_circle_outline, size: 50, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

// Audio message widget
class _AudioMessage extends StatefulWidget {
  final String url;

  const _AudioMessage({required this.url});

  @override
  State<_AudioMessage> createState() => _AudioMessageState();
}

class _AudioMessageState extends State<_AudioMessage> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isPlaying = false;
  bool _isLoading = false;
  String? _loadedUrl;
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();

    _audioPlayer.onDurationChanged.listen((duration) {
      if (mounted) setState(() => _duration = duration);
    });

    _audioPlayer.onPositionChanged.listen((position) {
      if (mounted) setState(() => _position = position);
    });

    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) setState(() => _isPlaying = false);
    });

    _preloadSource();
  }

  @override
  void didUpdateWidget(covariant _AudioMessage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _loadedUrl = null;
      _duration = Duration.zero;
      _position = Duration.zero;
      _preloadSource();
    }
  }

  Future<void> _preloadSource() async {
    if (_loadedUrl == widget.url) return;
    setState(() => _isLoading = true);
    try {
      if (widget.url.startsWith('http')) {
        await _audioPlayer.setSourceUrl(widget.url);
      } else {
        await _audioPlayer.setSourceDeviceFile(widget.url);
      }
      _loadedUrl = widget.url;
    } catch (e) {
      // ignore preload errors; will retry on play
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          IconButton(
            icon: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Icon(_isPlaying ? Icons.pause : Icons.play_arrow),
            color: Colors.white,
            onPressed: () async {
              if (_isLoading) return;
              if (_isPlaying) {
                await _audioPlayer.pause();
                setState(() => _isPlaying = false);
              } else {
                try {
                  await _preloadSource();
                  await _audioPlayer.resume();
                  setState(() => _isPlaying = true);
                } catch (_) {}
              }
            },
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LinearProgressIndicator(
                  value: _duration.inMilliseconds > 0
                      ? _position.inMilliseconds / _duration.inMilliseconds
                      : 0,
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_formatDuration(_position)} / ${_formatDuration(_duration)}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }
}

// Typing indicator widget
class TypingIndicator extends StatefulWidget {
  final String? avatarUrl;
  const TypingIndicator({super.key, this.avatarUrl});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          if (widget.avatarUrl != null) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: Colors.grey[800],
              backgroundImage: widget.avatarUrl!.startsWith('http')
                  ? NetworkImage(widget.avatarUrl!)
                  : null,
              onBackgroundImageError: (_, __) {},
            ),
            const SizedBox(width: 8),
          ],
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF2A2A2A),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (index) {
                return AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    final delay = index * 0.2;
                    final value = (_controller.value - delay).clamp(0.0, 1.0);
                    final opacity = (value * 2 - 1).abs();
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Opacity(
                        opacity: 1 - opacity,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.white54,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    );
                  },
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
