class PendingMedia {
  final String tempId;
  final String npcId;
  final String mediaType; // 'image', 'video', 'audio'
  String status; // 'loading', 'completed', 'failed'

  PendingMedia({
    required this.tempId,
    required this.npcId,
    required this.mediaType,
    this.status = 'loading',
  });
}
