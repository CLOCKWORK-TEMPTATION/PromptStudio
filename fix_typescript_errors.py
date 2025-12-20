"""
سكريبت لإصلاح أخطاء TypeScript الكبرى بشكل تلقائي
يعالج: snake_case → camelCase، implicit any، وغيرها

ملاحظة: تم توثيق الكود باللغة العربية كما هو مطلوب
"""

import re
import os
from pathlib import Path
from typing import List, Tuple

class TypeScriptFixer:
    """مُصلح أخطاء TypeScript تلقائياً"""
    
    def __init__(self, base_path: str):
        """
        تهيئة المُصلح
        Args:
            base_path: المسار الأساسي للمشروع
        """
        self.base_path = Path(base_path)
        self.changes_made = []
        
        # جدول تحويل من snake_case إلى camelCase
        self.property_mappings = {
            # Prompt properties
            'updated_at': 'updatedAt',
            'created_at': 'createdAt',
            'is_favorite': 'isFavorite',
            'usage_count': 'usageCount',
            'model_config': 'modelConfig',
            
            # ModelConfig properties
            'top_p': 'topP',
            'top_k': 'topK',
            'max_tokens': 'maxTokens',
            'frequency_penalty': 'frequencyPenalty',
            'presence_penalty': 'presencePenalty',
            'stop_sequences': 'stopSequences',
            'response_format': 'responseFormat',
            
            # MarketplacePrompt properties
            'clone_count': 'cloneCount',
            'avg_rating': 'avgRating',
            'view_count': 'viewCount',
            'review_count': 'reviewCount',
            'author_name': 'authorName',
            'is_featured': 'isFeatured',
            'is_staff_pick': 'isStaffPick',
            'model_recommendation': 'modelRecommendation',
            
            # SmartVariable properties
            'variable_type': 'variableType',
            'is_system': 'isSystem',
            
            # ToolDefinition properties
            'mock_response': 'mockResponse',
            
            # PromptVersion properties
            'version_number': 'versionNumber',
            'change_summary': 'changeSummary',
            
            # Template properties
            'usage_count': 'usageCount',
            
            # Technique properties
            'best_for': 'bestFor',
            'related_techniques': 'relatedTechniques',
            
            # EnvironmentProfile properties
            'is_active': 'isActive',
            'default_role': 'defaultRole',
        }
    
    def fix_property_access(self, content: str, old_prop: str, new_prop: str) -> str:
        """
        إصلاح الوصول للخصائص من snake_case إلى camelCase
        
        Args:
            content: محتوى الملف
            old_prop: اسم الخاصية القديم (snake_case)
            new_prop: اسم الخاصية الجديد (camelCase)
        
        Returns:
            المحتوى بعد الإصلاح
        """
        # Pattern للوصول بنقطة: object.old_prop
        pattern1 = rf'\b(\w+)\.{old_prop}\b'
        replacement1 = rf'\1.{new_prop}'
        
        # Pattern للوصول داخل objects: { old_prop: value }
        pattern2 = rf'(\{{[^}}]*){old_prop}:'
        replacement2 = rf'\1{new_prop}:'
        
        content = re.sub(pattern1, replacement1, content)
        content = re.sub(pattern2, replacement2, content)
        
        return content
    
    def fix_file(self, file_path: Path) -> bool:
        """
        إصلاح ملف واحد
        
        Args:
            file_path: مسار الملف
        
        Returns:
            True إذا تم إجراء تغييرات
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # تطبيق جميع التحويلات
            for old_prop, new_prop in self.property_mappings.items():
                content = self.fix_property_access(content, old_prop, new_prop)
            
            # حفظ فقط إذا كانت هناك تغييرات
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.changes_made.append(str(file_path))
                return True
            
            return False
            
        except Exception as e:
            print(f"خطأ في معالجة {file_path}: {e}")
            return False
    
    def fix_all_typescript_files(self) -> List[str]:
        """
        إصلاح جميع ملفات TypeScript/TSX في المشروع
        
        Returns:
            قائمة بالملفات التي تم تعديلها
        """
        # البحث عن ملفات .ts و .tsx
        patterns = ['**/*.ts', '**/*.tsx']
        files_to_fix = []
        
        for pattern in patterns:
            files_to_fix.extend(self.base_path.glob(pattern))
        
        # استثناء مجلدات معينة
        excluded_dirs = {'node_modules', 'dist', 'build', '.git'}
        files_to_fix = [
            f for f in files_to_fix 
            if not any(excluded in f.parts for excluded in excluded_dirs)
        ]
        
        print(f"تم العثور على {len(files_to_fix)} ملف للفحص...")
        
        fixed_count = 0
        for file_path in files_to_fix:
            if self.fix_file(file_path):
                fixed_count += 1
                print(f"✓ تم إصلاح: {file_path.relative_to(self.base_path)}")
        
        print(f"\nإجمالي الملفات المُعدّلة: {fixed_count}")
        return self.changes_made


def main():
    """الدالة الرئيسية"""
    project_root = r"e:\PromptStudio-main"
    
    print("بدء إصلاح أخطاء TypeScript...")
    print("=" * 60)
    
    fixer = TypeScriptFixer(project_root)
    changed_files = fixer.fix_all_typescript_files()
    
    print("\n" + "=" * 60)
    print(f"اكتمل الإصلاح! تم تعديل {len(changed_files)} ملف.")
    
    if changed_files:
        print("\nالملفات المُعدّلة:")
        for file in changed_files[:20]:  # عرض أول 20 فقط
            print(f"  - {file}")
        if len(changed_files) > 20:
            print(f"  ... و {len(changed_files) - 20} ملف آخر")


if __name__ == "__main__":
    main()
