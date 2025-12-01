class Npc {
  final String id;
  final String userId;
  final String name;
  final String? avatarUrl;
  final String? voicePreviewUrl;

  // Physical characteristics
  final String gender;
  final String? ethnicity;
  final String? bodyType;
  final String? hairLength;
  final String? hairColor;
  final String? eyeColor;
  final int? heightCm;
  final int? age;

  // Personality
  final String? personalityType;
  final String tone;

  final bool isActive;
  final bool isPublic;
  final DateTime createdAt;
  final DateTime updatedAt;

  Npc({
    required this.id,
    required this.userId,
    required this.name,
    this.gender = 'female',
    this.avatarUrl,
    this.voicePreviewUrl,
    this.ethnicity,
    this.bodyType,
    this.hairLength,
    this.hairColor,
    this.eyeColor,
    this.heightCm,
    this.age,
    this.personalityType,
    this.tone = 'flirty',
    this.isActive = true,
    this.isPublic = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Npc.fromJson(Map<String, dynamic> json) {
    DateTime _parseDate(dynamic value) {
      if (value == null) return DateTime.now();
      if (value is DateTime) return value;
      return DateTime.tryParse(value.toString()) ?? DateTime.now();
    }

    return Npc(
      id: json['id'],
      userId: json['user_id'],
      name: json['name'],
      gender: json['gender'] ?? 'female',
      avatarUrl: json['avatar_url'],
      voicePreviewUrl: json['voice_preview_url'],
      ethnicity: json['ethnicity'],
      bodyType: json['body_type'],
      hairLength: json['hair_length'],
      hairColor: json['hair_color'],
      eyeColor: json['eye_color'],
      heightCm: json['height_cm'],
      age: json['age'],
      personalityType: json['personality_type'],
      tone: json['tone'] ?? 'flirty',
      isActive: json['is_active'] ?? true,
      isPublic: json['is_public'] ?? false,
      createdAt: _parseDate(json['created_at']),
      updatedAt: _parseDate(json['updated_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'name': name,
      'gender': gender,
      'avatar_url': avatarUrl,
      'voice_preview_url': voicePreviewUrl,
      'ethnicity': ethnicity,
      'body_type': bodyType,
      'hair_length': hairLength,
      'hair_color': hairColor,
      'eye_color': eyeColor,
      'height_cm': heightCm,
      'age': age,
      'personality_type': personalityType,
      'tone': tone,
      'is_active': isActive,
      'is_public': isPublic,
    };
  }

  Npc copyWith({
    String? id,
    String? userId,
    String? name,
    String? gender,
    String? avatarUrl,
    String? voicePreviewUrl,
    String? ethnicity,
    String? bodyType,
    String? hairLength,
    String? hairColor,
    String? eyeColor,
    int? heightCm,
    int? age,
    String? personalityType,
    String? tone,
    bool? isActive,
    bool? isPublic,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Npc(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      gender: gender ?? this.gender,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      voicePreviewUrl: voicePreviewUrl ?? this.voicePreviewUrl,
      ethnicity: ethnicity ?? this.ethnicity,
      bodyType: bodyType ?? this.bodyType,
      hairLength: hairLength ?? this.hairLength,
      hairColor: hairColor ?? this.hairColor,
      eyeColor: eyeColor ?? this.eyeColor,
      heightCm: heightCm ?? this.heightCm,
      age: age ?? this.age,
      personalityType: personalityType ?? this.personalityType,
      tone: tone ?? this.tone,
      isActive: isActive ?? this.isActive,
      isPublic: isPublic ?? this.isPublic,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  String get displayDescription {
    final parts = <String>[];
    if (age != null) parts.add('$age anni');
    parts.add(gender == 'male' ? 'Uomo' : 'Donna');
    if (ethnicity != null) parts.add(ethnicity!);
    if (bodyType != null) parts.add(bodyType!);
    return parts.join(' • ');
  }
}
