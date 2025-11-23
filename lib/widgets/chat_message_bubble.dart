import 'package:flutter/material.dart';

class ChatMessageBubble extends StatelessWidget {
  final String content;
  final String? senderName;
  final String? avatarUrl;
  final String? imageUrl; // <--- NEW
  final bool isMe;
  final DateTime? timestamp;
  final VoidCallback? onAvatarTap;

  const ChatMessageBubble({
    super.key,
    required this.content,
    this.senderName,
    this.avatarUrl,
    this.imageUrl, // <--- NEW
    required this.isMe,
    this.timestamp,
    this.onAvatarTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          // Avatar a sinistra (solo per messaggi degli altri)
          if (!isMe) ...[
            GestureDetector(
              onTap: onAvatarTap,
              child: CircleAvatar(
                radius: 18,
                backgroundColor: Colors.grey[800],
                backgroundImage: (avatarUrl != null && avatarUrl!.length > 20)
                    ? NetworkImage(avatarUrl!)
                    : NetworkImage('https://ui-avatars.com/api/?name=${Uri.encodeComponent(senderName ?? "AI")}&background=random'),
                onBackgroundImageError: (_, __) {},
                child: null, // Rimuoviamo il child icona perché usiamo ui-avatars come fallback immagine
              ),
            ),
            const SizedBox(width: 8),
          ],

          // Bolla messaggio
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                // Nome mittente (solo per messaggi degli altri in gruppo)
                if (!isMe && senderName != null && senderName!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 4),
                    child: Text(
                      senderName!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[400], // Più chiaro per sfondo scuro
                      ),
                    ),
                  ),

                // Bolla
                Container(
                  padding: (imageUrl != null) 
                      ? const EdgeInsets.all(4) 
                      : const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isMe
                        ? const Color(0xFFE91E63) // Rosa per utente
                        : const Color(0xFF2A2A2A), // Scuro per AI
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
                  ),
                  child: (imageUrl != null && imageUrl!.isNotEmpty)
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.network(
                            imageUrl!,
                            width: 200,
                            fit: BoxFit.cover,
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return Container(
                                width: 200,
                                height: 200,
                                color: Colors.black12,
                                child: const Center(
                                  child: CircularProgressIndicator(
                                    color: Colors.pinkAccent,
                                    strokeWidth: 2,
                                  ),
                                ),
                              );
                            },
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                width: 200,
                                height: 150,
                                color: Colors.grey[800],
                                child: const Center(
                                  child: Icon(Icons.broken_image, color: Colors.white54),
                                ),
                              );
                            },
                          ),
                        )
                      : Text(
                          content,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            height: 1.4,
                          ),
                        ),
                ),

                // Timestamp (opzionale)
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

          // Spaziatura a destra per messaggi utente
          if (isMe && avatarUrl != null) const SizedBox(width: 26),
        ],
      ),
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
