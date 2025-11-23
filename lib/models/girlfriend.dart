class Girlfriend {
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
  final DateTime createdAt;
  final DateTime updatedAt;

  Girlfriend({
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
    required this.createdAt,
    required this.updatedAt,
  });

  factory Girlfriend.fromJson(Map<String, dynamic> json) {
    return Girlfriend(
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
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
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
    };
  }

  Girlfriend copyWith({
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
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Girlfriend(
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
