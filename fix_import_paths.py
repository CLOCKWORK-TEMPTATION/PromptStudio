"""
سكريبت لإصلاح استيراد أنواع collaboration و cache
تحويل @shared/types إلى المسار الصحيح

ملاحظة: تم توثيق الكود باللغة العربية
"""

import re
import os
from pathlib import Path
from typing import List

class ImportPathFixer:
    """مُصلح مسارات الاستيراد """
    
    def __init__(self, base_path: str):
        """
        تهيئة المُصلح
        Args:
            base_path: المسار الأساسي للمشروع
        """
        self.base_path = Path(base_path)
        self.changes_made = []
    
    def fix_shared_imports(self, content: str, file_path: Path) -> str:
        """
        إصل اح imports من @shared/types إلى المسار النسبي الصحيح
        
        Args:
            content: محتوى الملف
            file_path: مسار الملف الحالي
            
        Returns:
            المحتوى المُعدّل
        """
        # حساب المسار النسبي من الملف الحالي إلى shared/types
        try:
            # العد التصاعدي من الملف إلى src
            relative_depth = len(file_path.relative_to(self.base_path / 'src').parts) -1
            
            # بناء المسار النسبي
            if relative_depth == 0:
                relative_path = './shared/types'
            else:
                relative_path = '../' * relative_depth + 'shared/types'
            
            # استبدال @shared/types بالمسار النسبي
            pattern = r'@shared/types/(\w+)'
            replacement = rf'{relative_path}/\1.js'
            
            content = re.sub(pattern, replacement, content)
            
        except Exception as e:
            print(f"تحذير: فشل حساب المسار النسبي لـ {file_path}: {e}")
        
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
            
            # إصلاح المسارات
            content = self.fix_shared_imports(content, file_path)
            
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
    
    def fix_all_files(self) -> List[str]:
        """
        إصلاح جميع ملفات TypeScript/TSX في المشروع
        
        Returns:
            قائمة بالملفات التي تم تعديلها
        """
        # البحث عن ملفات .ts و .tsx
        patterns = ['**/*.ts', '**/*.tsx']
        files_to_fix = []
        
        for pattern in patterns:
            files_to_fix.extend((self.base_path / 'src').glob(pattern))
        
        # استثناء مجلدات معينة
        excluded_dirs = {'node_modules', 'dist', 'build'}
        files_to_fix = [
            f for f in files_to_fix 
            if not any(excluded in f.parts for excluded in excluded_dirs)
        ]
        
        print(f"تم العثور على {len(files_to_fix)} ملف للفحص...")
        
        fixed_count = 0
        for file_path in files_to_fix:
            if '@shared/types' in file_path.read_text(encoding='utf-8'):
                if self.fix_file(file_path):
                    fixed_count += 1
                    print(f"✓ تم إصلاح: {file_path.relative_to(self.base_path)}")
        
        print(f"\nإجمالي الملفات المُعدّلة: {fixed_count}")
        return self.changes_made


def main():
    """الدالة الرئيسية"""
    project_root = r"e:\PromptStudio-main"
    
    print("بدء إصلاح مسارات الاستيراد...")
    print("=" * 60)
    
    fixer = ImportPathFixer(project_root)
    changed_files = fixer.fix_all_files()
    
    print("\n" + "=" * 60)
    print(f"اكتمل الإصلاح! تم تعديل {len(changed_files)} ملف.")


if __name__ == "__main__":
    main()
