/**
 * ظ†ط¸ط§ظ… ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† طµط­ط© ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط±طھط¯ط§طھ (Lauf)
 * Validation Service v3.3 (Split Multi-Account Reporting)
 */

class ValidationService {
    constructor() {
        this.reset();
    }

    reset() {
        this.errors = [];
        this.validRecords = [];
        this.emptyCodeRecords = [];
        this.allRecordsWithStatus = [];

        // ظ…ط¬ظ…ظˆط¹ط§طھ ظ„طھطھط¨ط¹ ط§ظ„ظ‚ظٹظ… ط§ظ„ظ…طھط¹ط§ط±ط¶ط©
        this.conflictingNids = new Set();
        this.conflictingAccsOriginal = new Set();
        this.conflictingAccsEdited = new Set();

        // طھظ… ط§ظ„ظپطµظ„:
        this.conflictingNamesMultiAccOriginal = new Set();
        this.conflictingNamesMultiAccEdited = new Set();

        this.seenFullRecords = new Set();
        this.recordCounts = new Map(); // ظ„طھطھط¨ط¹ ط¹ط¯ط¯ طھظƒط±ط§ط± ظƒظ„ ط³ط¬ظ„ (ط§ظ„ط§ط³ظ… + ط§ظ„ط­ط³ط§ط¨)

        // -----------------------------------------------------------
        // ظ‚ظˆط§ط¦ظ… ط§ظ„طھظ‚ط§ط±ظٹط± ط§ظ„ط®ط§طµط©
        // -----------------------------------------------------------
        this.zeroAccountsOriginal = [];
        this.zeroAccountsEdited = [];

        this.originalHeaders = [];
        this.stats = {
            total: 0, valid: 0, invalid: 0,
            // عدد السجلات المتأثرة (affected rows)
            nidConflictCount: 0,
            accConflictOriginalCount: 0,
            accConflictEditedCount: 0,
            multiAccOriginalCount: 0,
            multiAccEditedCount: 0,
            duplicateRowCount: 0,
            zeroAccOriginalCount: 0,
            zeroAccEditedCount: 0,
            nidFormatCount: 0,
            accFormatOriginalCount: 0,
            accFormatEditedCount: 0,
            accFormatEditedCount: 0,
            missingCode: 0,
            // عدد المشاكل الفريدة (unique problems)
            uniqueNidConflicts: 0,
            uniqueAccConflictsOriginal: 0,
            uniqueAccConflictsEdited: 0,
            uniqueMultiAccOriginal: 0,
            uniqueMultiAccEdited: 0,
            // تنبيهات (لا تُبطل السجل)
            warningCount: 0
        };
    }

    // دالة مركزية للتحقق من صلاحية رقم الحساب (تجاهل الأصفار والفراغات)
    isValidAccount(val) {
        if (val === null || val === undefined) return false;
        const str = String(val).trim();
        if (str.length === 0) return false;
        if (str === '0') return false;
        // التحقق من الأصفار المتكررة أو الصيغ العشرية للصفر (00, 000, 0.0, 0.00)
        if (/^0+(\.0+)?$/.test(str)) return false;
        return true;
    }

    normalize(str) {
        if (str === null || str === undefined) return '';
        let text = String(str).trim();
        if (text.length === 0) return '';
        text = text.replace(/[\u064B-\u065F\u0640]/g, '');
        text = text.replace(/[ط£ط¥ط¢]/g, 'ط§');
        text = text.replace(/[ظ‰]/g, 'ظٹ');
        text = text.replace(/[ط©]/g, 'ظ‡');
        text = text.replace(/\s+/g, ' ');
        return text;
    }

    getValue(row, keys) {
        for (const key of keys) {
            const foundKey = Object.keys(row).find(k =>
                this.normalize(k).toLowerCase() === this.normalize(key).toLowerCase()
            );
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
                const val = row[foundKey];
                // إذا كانت القيمة مسافات فقط، نعتبرها فارغة
                if (typeof val === 'string' && val.trim().length === 0) continue;
                return { value: val, key: foundKey };
            }
        }
        return { value: null, key: null };
    }

    validate(data, dbRecords = []) {
        this.reset();
        this.stats.total = data.length;
        if (data.length > 0) this.originalHeaders = Object.keys(data[0]);

        // تحديد ما إذا كان ملف الإدخال يحتوي على عمود رقم الحساب المعدل
        const editedHeadersList = ['رقم الحساب بعد التعديل', 'تعديل رقم الحساب', 'EditedAccountNumber', 'NewAccountNumber', 'Edited Account Number'];
        const hasEditedColumn = this.originalHeaders && this.originalHeaders.some(h => editedHeadersList.includes(h));

        // =============================================
        // المرحلة 1: بناء Maps (First Pass)
        // =============================================
        const nidNameMap = new Map();
        const accOriginalNameMap = new Map();
        const accEditedNameMap = new Map();

        // خرائط منفصلة لتعدد الحسابات
        const nameToAccOriginalMap = new Map();
        const nameToAccEditedMap = new Map();

        data.forEach((row, index) => {
            const name = this.getValue(row, ['الاسم', 'Name', 'FullName']).value;
            const nationalId = this.getValue(row, ['الرقم القومي', 'NationalID', 'National Id']).value;
            const accEdited = this.getValue(row, ['رقم الحساب بعد التعديل', 'تعديل رقم الحساب', 'EditedAccountNumber', 'NewAccountNumber']).value;
            const accOriginal = this.getValue(row, ['رقم الحساب', 'AccountNumber', 'Account No', 'رقمالحساب']).value;

            const nameStr = this.normalize(name);
            const nidStr = this.normalize(nationalId);

            // 1. الرقم القومي (يتم التخزين فقط إذا وجد رقم قومي واسم صالحين)
            if (nidStr && nidStr.length > 0) {
                if (!nidNameMap.has(nidStr)) nidNameMap.set(nidStr, new Set());
                if (nameStr && nameStr.length > 0) nidNameMap.get(nidStr).add(nameStr);
            }

            // 2. رقم الحساب الأصلي
            if (this.isValidAccount(accOriginal)) {
                const accStr = String(accOriginal).trim();
                // تعارض الحساب نفسه
                if (!accOriginalNameMap.has(accStr)) accOriginalNameMap.set(accStr, new Set());
                if (nameStr && nameStr.length > 0) accOriginalNameMap.get(accStr).add(nameStr);

                // تعدد حسابات الشخص (أصلي فقط)
                if (nameStr && nameStr.length > 0) {
                    if (!nameToAccOriginalMap.has(nameStr)) nameToAccOriginalMap.set(nameStr, new Set());
                    nameToAccOriginalMap.get(nameStr).add(accStr);
                }
            }

            // 3. رقم الحساب المعدل
            if (this.isValidAccount(accEdited)) {
                const accStr = String(accEdited).trim();
                // تعارض الحساب نفسه
                if (!accEditedNameMap.has(accStr)) accEditedNameMap.set(accStr, new Set());
                if (nameStr && nameStr.length > 0) accEditedNameMap.get(accStr).add(nameStr);

                // تعدد حسابات الشخص (معدل فقط)
                if (nameStr && nameStr.length > 0) {
                    if (!nameToAccEditedMap.has(nameStr)) nameToAccEditedMap.set(nameStr, new Set());
                    nameToAccEditedMap.get(nameStr).add(accStr);
                }
            }
        });

        // 4. التحقق المتقاطع مع قاعدة البيانات (إذا توفرت)
        if (dbRecords && dbRecords.length > 0) {
            dbRecords.forEach(dbRow => {
                const dbName = this.normalize(dbRow.Name || dbRow.BeneficiaryName || dbRow.الاسم);
                const dbNid = this.normalize(dbRow.NationalID || dbRow.الرقم_القومي || dbRow['الرقم القومي']);
                const dbAcc = String(dbRow.AccountNumber || dbRow.رقم_الحساب || dbRow['رقم الحساب']).trim();

                if (dbNid) {
                    if (!nidNameMap.has(dbNid)) nidNameMap.set(dbNid, new Set());
                    if (dbName) nidNameMap.get(dbNid).add(dbName);
                }

                if (this.isValidAccount(dbAcc)) {
                    if (!accOriginalNameMap.has(dbAcc)) accOriginalNameMap.set(dbAcc, new Set());
                    if (dbName) accOriginalNameMap.get(dbAcc).add(dbName);
                }
            });
        }

        // =============================================
        // المرحلة 2: تحديد القيم المتعارضة (Identification Phase)
        // =============================================

        nidNameMap.forEach((names, nid) => {
            if (names.size > 1) {
                this.conflictingNids.add(nid);
                this.stats.uniqueNidConflicts++;
            }
        });

        accOriginalNameMap.forEach((names, acc) => {
            if (names.size > 1) {
                this.conflictingAccsOriginal.add(acc);
                this.stats.uniqueAccConflictsOriginal++;
            }
        });

        accEditedNameMap.forEach((names, acc) => {
            if (names.size > 1) {
                this.conflictingAccsEdited.add(acc);
                this.stats.uniqueAccConflictsEdited++;
            }
        });

        // فحص تعدد الأصلي
        nameToAccOriginalMap.forEach((accs, name) => {
            const validAccs = new Set();
            accs.forEach(acc => { if (this.isValidAccount(acc)) validAccs.add(acc); });
            if (validAccs.size > 1) {
                this.conflictingNamesMultiAccOriginal.add(name);
                this.stats.uniqueMultiAccOriginal++;
            }
        });

        // فحص تعدد المعدل
        nameToAccEditedMap.forEach((accs, name) => {
            const validAccs = new Set();
            accs.forEach(acc => { if (this.isValidAccount(acc)) validAccs.add(acc); });
            if (validAccs.size > 1) {
                this.conflictingNamesMultiAccEdited.add(name);
                this.stats.uniqueMultiAccEdited++;
            }
        });

        // =============================================
        // المرحلة 3: فحص السجلات وتعبئة النتائج (Final Pass)
        // =============================================

        data.forEach((row, index) => {
            let rowErrors = [];
            let rowWarnings = [];
            const name = this.getValue(row, ['الاسم', 'Name', 'FullName']).value;
            const nationalId = this.getValue(row, ['الرقم القومي', 'NationalID', 'National Id']).value;
            const accEdited = this.getValue(row, ['رقم الحساب بعد التعديل', 'تعديل رقم الحساب', 'EditedAccountNumber', 'NewAccountNumber']).value;
            const accOriginal = this.getValue(row, ['رقم الحساب', 'AccountNumber', 'Account No', 'رقمالحساب']).value;

            const nameStr = this.normalize(name);
            const nidStr = this.normalize(nationalId);

            const isOriginalValid = this.isValidAccount(accOriginal);
            const isEditedValid = this.isValidAccount(accEdited);

            // 00. التحقق من الحقول الإلزامية
            if (!nameStr) {
                rowErrors.push({ type: 'missing_field', field: 'الاسم', message: 'حقل الاسم مطلوب ولا يمكن أن يكون فارغاً' });
            }
            if (!nidStr) {
                rowErrors.push({ type: 'missing_field', field: 'الرقم القومي', message: 'حقل الرقم القومي مطلوب' });
            }

            // 0. تجميع الحسابات الصفرية
            // (أصلي)
            if (!isOriginalValid) {
                this.zeroAccountsOriginal.push({ ...row, 'نوع الخطأ': 'تنبيه', 'وصف الخطأ': 'رقم الحساب (الأصلي) فارغ أو صفر' });
                this.stats.zeroAccOriginalCount++;
            }

            // (معدل) - فقط إذا كان العمود موجوداً في الملف
            if (hasEditedColumn && !isEditedValid) {
                this.zeroAccountsEdited.push({ ...row, 'نوع الخطأ': 'تنبيه', 'وصف الخطأ': 'رقم الحساب (المعدل) فارغ أو صفر' });
                this.stats.zeroAccEditedCount++;
            }

            // * فحص تكرار السجل بالكامل + حساب الإحصائيات *
            if (nameStr && isOriginalValid) {
                const accStr = String(accOriginal).trim();
                const recordKey = nameStr + '|' + accStr;

                // حساب التكرارات للإحصائيات
                if (!this.recordCounts.has(recordKey)) {
                    this.recordCounts.set(recordKey, { count: 0, row: row });
                }
                this.recordCounts.get(recordKey).count++;

                // فحص الأخطاء (سجل مكرر)
                if (this.seenFullRecords.has(recordKey)) {
                    rowErrors.push({ type: 'duplicate_row', field: 'السجل', message: 'سجل مكرر بالكامل (نفس الاسم ونفس رقم الحساب)' });
                } else {
                    this.seenFullRecords.add(recordKey);
                }
            }

            // 1. الرقم القومي
            if (nidStr) {
                const nidDigitsOnly = nidStr.replace(/\D/g, '');
                if (nidDigitsOnly.length !== 14) {
                    rowErrors.push({ type: 'format', field: 'الرقم القومي', message: `طول الرقم القومي غير صحيح (${nidDigitsOnly.length} رقم بدلاً من 14)` });
                }

                if (this.conflictingNids.has(nidStr)) {
                    const names = nidNameMap.get(nidStr);
                    const conflictNames = [...names].join(' | ');
                    rowErrors.push({ type: 'conflict', field: 'الرقم القومي', message: `الرقم القومي مكرر مع: (${conflictNames})` });
                    row._conflictDetailsNid = conflictNames;
                }
            }

            // 2. رقم الحساب الأصلي
            if (isOriginalValid) {
                const accStr = String(accOriginal).trim();
                if (![16, 26, 29].includes(accStr.length)) {
                    rowErrors.push({ type: 'format', field: 'رقم الحساب', message: `طول رقم الحساب ${accStr.length} غير صالح (يجب أن يكون 16 أو 26 أو 29)` });
                }

                if (this.conflictingAccsOriginal.has(accStr)) {
                    const names = accOriginalNameMap.get(accStr);
                    const conflictNames = [...names].join(' | ');
                    rowErrors.push({ type: 'conflict_original', field: 'رقم الحساب', message: `رقم الحساب (الأصلي) مكرر مع: (${conflictNames})` });
                    row._conflictDetailsAccOriginal = conflictNames;
                }
            }

            // 3. رقم الحساب المعدل
            if (isEditedValid) {
                const accStr = String(accEdited).trim();
                if (![16, 26, 29].includes(accStr.length)) {
                    rowErrors.push({ type: 'format', field: 'رقم الحساب المعدل', message: `طول رقم الحساب المعدل ${accStr.length} غير صالح (يجب أن يكون 16 أو 26 أو 29)` });
                }

                if (this.conflictingAccsEdited.has(accStr)) {
                    const names = accEditedNameMap.get(accStr);
                    const conflictNames = [...names].join(' | ');
                    rowErrors.push({ type: 'conflict_edited', field: 'رقم الحساب المعدل', message: `رقم الحساب (المعدل) مكرر مع: (${conflictNames})` });
                    row._conflictDetailsAccEdited = conflictNames;
                }
            }

            // 4. تعدد الحسابات (أصلي)
            if (nameStr && isOriginalValid && this.conflictingNamesMultiAccOriginal.has(nameStr)) {
                const accounts = nameToAccOriginalMap.get(nameStr);
                const validAccList = [...accounts].filter(a => this.isValidAccount(a));
                const accountList = validAccList.join(' | ');
                rowErrors.push({ type: 'multi_acc_original', field: 'الاسم', message: `الشخص يمتلك أكثر من حساب (أصلي) مختلف: (${accountList})` });
                row._conflictDetailsMultiAccOriginal = accountList;
            }

            // 5. تعدد الحسابات (معدل)
            if (nameStr && isEditedValid && this.conflictingNamesMultiAccEdited.has(nameStr)) {
                const accounts = nameToAccEditedMap.get(nameStr);
                const validAccList = [...accounts].filter(a => this.isValidAccount(a));
                const accountList = validAccList.join(' | ');
                rowErrors.push({ type: 'multi_acc_edited', field: 'الاسم', message: `الشخص يمتلك أكثر من حساب (معدل) مختلف: (${accountList})` });
                row._conflictDetailsMultiAccEdited = accountList;
            }

            // 6. كود الملف (تنبيه فقط - لا يُبطل السجل)
            const fileCode = this.getValue(row, ['كود الملف', 'كودالملف', 'FileCode', 'Code']).value;
            if (!fileCode && fileCode !== 0) {
                rowWarnings.push({ type: 'missing', field: 'كود الملف', message: 'كود الملف فارغ' });
            }

            // --- التجميع ---
            // التنبيهات (كود مفقود) لا تُبطل السجل
            rowWarnings.forEach(w => {
                if (w.type === 'missing') this.stats.missingCode++;
                this.stats.warningCount++;
            });

            // الأخطاء الحقيقية فقط تُبطل السجل
            const hasRealErrors = rowErrors.length > 0;
            const statusText = hasRealErrors ? 'خطأ' : (rowWarnings.length > 0 ? 'تنبيه' : 'صحيح');
            this.allRecordsWithStatus.push({ ...row, 'نتيجة الفحص': statusText });

            if (hasRealErrors) {
                this.stats.invalid++;

                rowErrors.forEach(e => {
                    if (e.type === 'conflict') this.stats.nidConflictCount++;
                    if (e.type === 'conflict_original') this.stats.accConflictOriginalCount++;
                    if (e.type === 'conflict_edited') this.stats.accConflictEditedCount++;
                    if (e.type === 'multi_acc_original') this.stats.multiAccOriginalCount++;
                    if (e.type === 'multi_acc_edited') this.stats.multiAccEditedCount++;
                    if (e.type === 'duplicate_row') this.stats.duplicateRowCount++;
                    if (e.type === 'format' && e.field.includes('القومي')) this.stats.nidFormatCount++;

                    // فصل إحصائيات تنسيق الحساب
                    if (e.type === 'format' && e.field === 'رقم الحساب') this.stats.accFormatOriginalCount++;
                    if (e.type === 'format' && e.field === 'رقم الحساب المعدل') this.stats.accFormatEditedCount++;
                });

                // دمج التنبيهات مع الأخطاء في سجل واحد
                const allErrors = [...rowErrors, ...rowWarnings];
                this.errors.push({ row: index + 2, data: row, errors: allErrors });
            } else {
                this.stats.valid++;
                this.validRecords.push(row);
                // إذا كان فيه تنبيهات فقط، نضيفها للأخطاء لكن السجل يبقى "صحيح"
                if (rowWarnings.length > 0) {
                    this.errors.push({ row: index + 2, data: row, errors: rowWarnings });
                }
            }
        });

        return {
            isValid: this.stats.invalid === 0,
            stats: this.stats,
            errors: this.errors,
            validRecords: this.validRecords,
            allRecordsWithStatus: this.allRecordsWithStatus
        };
    }

    // دالة لتصدير تقرير إحصائيات التكرار
    exportRepetitionStats(filename = 'تقرير_تكرار_الحسابات.xlsx') {
        if (this.recordCounts.size === 0) return false;

        const workbook = XLSX.utils.book_new();

        // 1. صفحة البيانات الفريدة (Unique Data - Full Details)
        const uniqueData = Array.from(this.recordCounts.values()).map(item => {
            const ordered = {};
            this.originalHeaders.forEach(h => ordered[h] = item.row[h] ?? '');
            return ordered;
        });
        const sheetUnique = XLSX.utils.json_to_sheet(uniqueData, { header: this.originalHeaders });
        XLSX.utils.book_append_sheet(workbook, sheetUnique, 'بيانات تفصيلية (بدون تكرار)');


        // 2. صفحة ملخص التكرار (Brief Summary: Name, Account, Count)
        const summaryData = Array.from(this.recordCounts.values()).map(item => {
            const nameVal = this.getValue(item.row, ['الاسم', 'Name', 'FullName']).value;
            const accVal = this.getValue(item.row, ['رقم الحساب', 'AccountNumber', 'Account No', 'رقمالحساب']).value;

            return {
                'الاسم': nameVal,
                'رقم الحساب': accVal,
                'عدد التكرار': item.count
            };
        });

        // فرز تنازلي حسب العدد
        summaryData.sort((a, b) => b['عدد التكرار'] - a['عدد التكرار']);

        const sheetSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, sheetSummary, 'ملخص التكرار');

        XLSX.writeFile(workbook, filename);
        return true;
    }

    // =============================================
    // ط¯ظˆط§ظ„ ط§ظ„طھطµط¯ظٹط±
    // =============================================

    exportSpecificError(type, filename) {
        let dataToExport = [];

        switch (type) {
            case 'zeroAccOriginal': // الحسابات الصفرية (أصلي)
                dataToExport = this.zeroAccountsOriginal;
                break;

            case 'zeroAccEdited': // الحسابات الصفرية (معدل)
                dataToExport = this.zeroAccountsEdited;
                break;

            case 'duplicateRow':
                dataToExport = this._getLegacyErrorData('duplicate_row', 'السجل');

                const summaryDup = [];
                const dupSummaryMap = new Map();
                dataToExport.forEach(r => {
                    const n = this.getValue(r, ['الاسم', 'Name']).value;
                    if (n) dupSummaryMap.set(n, (dupSummaryMap.get(n) || 0) + 1);
                });
                dupSummaryMap.forEach((count, name) => summaryDup.push({ 'الاسم': name, 'عدد السجلات المكررة': count }));

                const wbDup = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbDup, XLSX.utils.json_to_sheet(dataToExport), 'تفصيلي');
                XLSX.utils.book_append_sheet(wbDup, XLSX.utils.json_to_sheet(summaryDup), 'ملخص');
                XLSX.writeFile(wbDup, filename);
                return true;

            case 'nidConflict':
                dataToExport = this.allRecordsWithStatus.filter(row => {
                    const val = this.getValue(row, ['الرقم القومي', 'NationalID', 'National Id']).value;
                    const norm = this.normalize(val);
                    return norm && this.conflictingNids.has(norm);
                }).map(row => ({
                    ...row,
                    'نوع الخطأ': 'تعارض رقم قومي',
                    'وصف الخطأ': `الرقم القومي مكرر مع: (${row._conflictDetailsNid || 'غير محدد'})`
                }));

                // ملخص: الاسم | عدد السجلات
                const summaryNid = [];
                const nidSummaryMap = new Map();
                dataToExport.forEach(r => {
                    const n = this.getValue(r, ['الاسم', 'Name']).value;
                    if (n) nidSummaryMap.set(n, (nidSummaryMap.get(n) || 0) + 1);
                });
                nidSummaryMap.forEach((count, name) => summaryNid.push({ 'الاسم': name, 'عدد السجلات': count }));

                const wbNid = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbNid, XLSX.utils.json_to_sheet(dataToExport), 'تفصيلي');
                XLSX.utils.book_append_sheet(wbNid, XLSX.utils.json_to_sheet(summaryNid), 'ملخص');
                XLSX.writeFile(wbNid, filename);
                return true;

            case 'accConflictOriginal':
                dataToExport = this.allRecordsWithStatus.filter(row => {
                    const val = this.getValue(row, ['رقم الحساب', 'AccountNumber', 'Account No', 'رقمالحساب']).value;
                    if (!this.isValidAccount(val)) return false;
                    const norm = String(val).trim();
                    return this.conflictingAccsOriginal.has(norm);
                }).map(row => ({
                    ...row,
                    'نوع الخطأ': 'تعارض حساب أصلي',
                    'وصف الخطأ': `رقم الحساب مكرر مع: (${row._conflictDetailsAccOriginal || 'غير محدد'})`
                }));

                const summaryAccOrg = [];
                const accOrgSummaryGroups = new Map();
                dataToExport.forEach(r => {
                    const n = this.getValue(r, ['الاسم', 'Name']).value;
                    if (n) accOrgSummaryGroups.set(n, (accOrgSummaryGroups.get(n) || 0) + 1);
                });
                accOrgSummaryGroups.forEach((count, name) => summaryAccOrg.push({ 'الاسم': name, 'عدد السجلات': count }));

                const wbAccOrg = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbAccOrg, XLSX.utils.json_to_sheet(dataToExport), 'تفصيلي');
                XLSX.utils.book_append_sheet(wbAccOrg, XLSX.utils.json_to_sheet(summaryAccOrg), 'ملخص');
                XLSX.writeFile(wbAccOrg, filename);
                return true;

            case 'accConflictEdited':
                dataToExport = this.allRecordsWithStatus.filter(row => {
                    const val = this.getValue(row, ['رقم الحساب بعد التعديل', 'تعديل رقم الحساب', 'EditedAccountNumber']).value;
                    if (!this.isValidAccount(val)) return false;
                    const norm = String(val).trim();
                    return this.conflictingAccsEdited.has(norm);
                }).map(row => ({
                    ...row,
                    'نوع الخطأ': 'تعارض حساب معدل',
                    'وصف الخطأ': `رقم الحساب المعدل مكرر مع: (${row._conflictDetailsAccEdited || 'غير محدد'})`
                }));

                const summaryAccEdi = [];
                const accEdiSummaryGroups = new Map();
                dataToExport.forEach(r => {
                    const n = this.getValue(r, ['الاسم', 'Name']).value;
                    if (n) accEdiSummaryGroups.set(n, (accEdiSummaryGroups.get(n) || 0) + 1);
                });
                accEdiSummaryGroups.forEach((count, name) => summaryAccEdi.push({ 'الاسم': name, 'عدد السجلات': count }));

                const wbAccEdi = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbAccEdi, XLSX.utils.json_to_sheet(dataToExport), 'تفصيلي');
                XLSX.utils.book_append_sheet(wbAccEdi, XLSX.utils.json_to_sheet(summaryAccEdi), 'ملخص');
                this._addPivotSheet(wbAccEdi, dataToExport, 'بيفوت - تكرار الحسابات');
                XLSX.writeFile(wbAccEdi, filename);
                return true;

            case 'multiAccOriginal':
                const seenOrg = new Set();
                dataToExport = this.allRecordsWithStatus.filter(row => {
                    const nameVal = this.getValue(row, ['الاسم', 'Name', 'FullName']).value;
                    const norm = this.normalize(nameVal);
                    const accVal = this.getValue(row, ['رقم الحساب', 'AccountNumber', 'Account No', 'رقمالحساب']).value;
                    const accStr = String(accVal).trim();

                    if (norm && this.conflictingNamesMultiAccOriginal.has(norm) && this.isValidAccount(accVal)) {
                        const key = `${norm}|${accStr}`;
                        if (seenOrg.has(key)) return false;
                        seenOrg.add(key);
                        return true;
                    }
                    return false;
                }).map(row => ({
                    ...row,
                    'نوع الخطأ': 'تعدد حسابات (أصلي)',
                    'وصف الخطأ': `الشخص يمتلك أكثر من حساب أصلي مختلف: (${row._conflictDetailsMultiAccOriginal || 'غير محدد'})`
                }));

                const summaryOrg = [];
                this.conflictingNamesMultiAccOriginal.forEach(name => {
                    const personRows = dataToExport.filter(r => this.normalize(this.getValue(r, ['الاسم', 'Name']).value) === name);
                    if (personRows.length === 0) return;

                    summaryOrg.push({
                        'الاسم': personRows[0] ? this.getValue(personRows[0], ['الاسم', 'Name']).value : name,
                        'عدد الحسابات': personRows.length
                    });
                });

                const wbOrg = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbOrg, XLSX.utils.json_to_sheet(dataToExport), 'تفصيلي');
                XLSX.utils.book_append_sheet(wbOrg, XLSX.utils.json_to_sheet(summaryOrg), 'ملخص');
                XLSX.writeFile(wbOrg, filename);
                return true;

            case 'multiAccEdited':
                const seenEdi = new Set();
                dataToExport = this.allRecordsWithStatus.filter(row => {
                    const nameVal = this.getValue(row, ['الاسم', 'Name', 'FullName']).value;
                    const norm = this.normalize(nameVal);
                    const accVal = this.getValue(row, ['رقم الحساب بعد التعديل', 'تعديل رقم الحساب', 'EditedAccountNumber', 'NewAccountNumber']).value;
                    const accStr = String(accVal).trim();

                    if (norm && this.conflictingNamesMultiAccEdited.has(norm) && this.isValidAccount(accVal)) {
                        const key = `${norm}|${accStr}`;
                        if (seenEdi.has(key)) return false;
                        seenEdi.add(key);
                        return true;
                    }
                    return false;
                }).map(row => ({
                    ...row,
                    'نوع الخطأ': 'تعدد حسابات (معدل)',
                    'وصف الخطأ': `الشخص يمتلك أكثر من حساب معدل مختلف: (${row._conflictDetailsMultiAccEdited || 'غير محدد'})`
                }));

                const summaryEdi = [];
                this.conflictingNamesMultiAccEdited.forEach(name => {
                    const personRows = dataToExport.filter(r => this.normalize(this.getValue(r, ['الاسم', 'Name']).value) === name);
                    if (personRows.length === 0) return;

                    summaryEdi.push({
                        'الاسم': personRows[0] ? this.getValue(personRows[0], ['الاسم', 'Name']).value : name,
                        'عدد الحسابات': personRows.length
                    });
                });

                const wbEdi = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbEdi, XLSX.utils.json_to_sheet(dataToExport), 'تفصيلي');
                XLSX.utils.book_append_sheet(wbEdi, XLSX.utils.json_to_sheet(summaryEdi), 'ملخص');
                XLSX.writeFile(wbEdi, filename);
                return true;

            case 'nidFormat':
                dataToExport = this._getLegacyErrorData('format', 'القومي');
                break;

            case 'accFormatOriginal':
                dataToExport = this.errors.filter(errItem =>
                    errItem.errors.some(e => e.type === 'format' && e.field === 'رقم الحساب')
                ).map(errItem => ({
                    ...errItem.data,
                    'نوع الخطأ': 'تنسيق رقم حساب',
                    'وصف الخطأ': errItem.errors.filter(e => e.type === 'format' && e.field === 'رقم الحساب').map(e => e.message).join(', ')
                }));
                break;

            case 'accFormatEdited':
                dataToExport = this.errors.filter(errItem =>
                    errItem.errors.some(e => e.type === 'format' && e.field === 'رقم الحساب المعدل')
                ).map(errItem => ({
                    ...errItem.data,
                    'نوع الخطأ': 'تنسيق رقم حساب معدل',
                    'وصف الخطأ': errItem.errors.filter(e => e.type === 'format' && e.field === 'رقم الحساب المعدل').map(e => e.message).join(', ')
                }));
                break;

            case 'missingCode':
                dataToExport = this._getLegacyErrorData('missing', 'كود الملف');
                break;
        }

        if (dataToExport.length === 0) return false;

        const headers = [...this.originalHeaders, 'نوع الخطأ', 'وصف الخطأ'];
        this._downloadExcel(dataToExport, headers, filename, 'البيانات');
        return true;
    }

    _getLegacyErrorData(typeFilter, fieldFilterPart) {
        let result = [];
        this.errors.forEach(errItem => {
            const relevantErrors = errItem.errors.filter(e => e.type === typeFilter && e.field.includes(fieldFilterPart));
            if (relevantErrors.length > 0) {
                result.push({
                    ...errItem.data,
                    'نوع الخطأ': relevantErrors.map(e => e.type).join(', '),
                    'وصف الخطأ': relevantErrors.map(e => e.message).join(', ')
                });
            }
        });
        return result;
    }

    _downloadExcel(data, headers, filename, sheetName) {
        if (!data || data.length === 0) return;
        const workbook = XLSX.utils.book_new();

        // ترتيب الأعمدة
        const orderedData = data.map(row => {
            const ordered = {};
            headers.forEach(h => ordered[h] = row[h] ?? '');
            return ordered;
        });

        const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: headers });
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, filename);
    }

    _addPivotSheet(workbook, data, sheetName) {
        if (!data || data.length === 0) return;

        // 1. Group by Account
        const groups = new Map();
        data.forEach(row => {
            const acc = this.getValue(row, ['رقم الحساب بعد التعديل', 'تعديل رقم الحساب', 'EditedAccountNumber', 'NewAccountNumber']).value || 'غير محدد';
            const accStr = String(acc).trim();
            if (!groups.has(accStr)) groups.set(accStr, []);
            groups.get(accStr).push(row);
        });

        // 2. Flatten for Excel
        const rows = [];
        const merges = [];
        let currentRowIndex = 1; // 0 is header

        groups.forEach((groupRows, accStr) => {
            const startRow = currentRowIndex;
            groupRows.forEach(row => {
                const name = this.getValue(row, ['الاسم', 'Name', 'FullName']).value || '';
                const code = this.getValue(row, ['كود الملف', 'كودالملف', 'FileCode', 'Code']).value || '';
                rows.push({
                    'رقم الحساب بعد التعديل': accStr,
                    'الاسم': name,
                    'كود الملف': code
                });
                currentRowIndex++;
            });
            const endRow = currentRowIndex - 1;

            // Merge if more than 1 row
            if (endRow > startRow) {
                merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
            }
        });

        // 3. Create Sheet
        const worksheet = XLSX.utils.json_to_sheet(rows);
        if (merges.length > 0) worksheet['!merges'] = merges;

        // Custom column widths
        worksheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    exportAllErrorsMultiSheet(filename = 'جميع_الأخطاء.xlsx') {
        const workbook = XLSX.utils.book_new();
        let hasSheets = false;
        const headers = [...this.originalHeaders, 'نوع الخطأ', 'وصف الخطأ'];

        const addSheet = (data, name) => {
            if (data && data.length > 0) {
                const orderedData = data.map(row => {
                    const ordered = {};
                    headers.forEach(h => ordered[h] = row[h] ?? '');
                    return ordered;
                });
                const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: headers });

                // Truncate name to 31 chars (Excel limit)
                const safeName = name.length > 31 ? name.substring(0, 31) : name;

                XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
                hasSheets = true;
            }
        };

        // 1. Nid Conflict
        const nidData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الرقم القومي', 'NationalID']).value;
            return v && this.conflictingNids.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض قومي',
            'وصف الخطأ': `الرقم القومي مكرر مع: (${row._conflictDetailsNid || 'غير محدد'})`
        }));
        addSheet(nidData, 'تكرر رقم قومي مع أسامي مختلفة');

        // 2. Acc Original Conflict
        const accOrgData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['رقم الحساب', 'AccountNumber']).value;
            return this.isValidAccount(v) && this.conflictingAccsOriginal.has(String(v).trim());
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض حساب أصلي',
            'وصف الخطأ': `رقم الحساب مكرر مع: (${row._conflictDetailsAccOriginal || 'غير محدد'})`
        }));
        addSheet(accOrgData, 'تكرر رقم حساب (أصلي)');

        // 3. Acc Edited Conflict
        const accEdData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['رقم الحساب بعد التعديل', 'EditedAccountNumber']).value;
            return this.isValidAccount(v) && this.conflictingAccsEdited.has(String(v).trim());
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض حساب معدل',
            'وصف الخطأ': `رقم الحساب المعدل مكرر مع: (${row._conflictDetailsAccEdited || 'غير محدد'})`
        }));
        addSheet(accEdData, 'تكرر رقم حساب (معدل)');
        this._addPivotSheet(workbook, accEdData, 'بيفوت - تكرار الحسابات');

        // 4. Multi Acc Original
        const multiDataOrg = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الاسم', 'Name']).value;
            return v && this.conflictingNamesMultiAccOriginal.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعدد حسابات (أصلي)',
            'وصف الخطأ': `الشخص يمتلك أكثر من حساب أصلي مختلف: (${row._conflictDetailsMultiAccOriginal || 'غير محدد'})`
        }));
        addSheet(multiDataOrg, 'نفس الشخص له أكثر من حساب(أصلي)');

        // 5. Multi Acc Edited
        const multiDataEdi = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الاسم', 'Name']).value;
            return v && this.conflictingNamesMultiAccEdited.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعدد حسابات (معدل)',
            'وصف الخطأ': `الشخص يمتلك أكثر من حساب معدل مختلف: (${row._conflictDetailsMultiAccEdited || 'غير محدد'})`
        }));
        addSheet(multiDataEdi, 'نفس الشخص له أكثر من حساب(معدل)');

        // 6. Nid Format
        addSheet(this._getLegacyErrorData('format', 'القومي'), 'رقم قومي لا يساوي 14 رقم');

        // 7. Acc Format (Original & Edited)
        const accFormatOrg = [];
        const accFormatEdi = [];

        this.errors.forEach(item => {
            const orgErrs = item.errors.filter(e => e.type === 'format' && e.field === 'رقم الحساب');
            if (orgErrs.length > 0) {
                accFormatOrg.push({
                    ...item.data,
                    'نوع الخطأ': 'تنسيق رقم حساب',
                    'وصف الخطأ': orgErrs.map(e => e.message).join(', ')
                });
            }

            const ediErrs = item.errors.filter(e => e.type === 'format' && e.field === 'رقم الحساب المعدل');
            if (ediErrs.length > 0) {
                accFormatEdi.push({
                    ...item.data,
                    'نوع الخطأ': 'تنسيق رقم حساب معدل',
                    'وصف الخطأ': ediErrs.map(e => e.message).join(', ')
                });
            }
        });

        addSheet(accFormatOrg, 'رقم حساب (أصلي) ليس 16,26,29');
        addSheet(accFormatEdi, 'رقم حساب (معدل) ليس 16,26,29');

        // 8. Missing Code
        addSheet(this._getLegacyErrorData('missing', 'كود الملف'), 'كود ملف مفقود (فارغ)');

        // 9. Zero Accounts
        addSheet(this.zeroAccountsOriginal, 'حسابات صفرية أو فارغة (أصلي)');
        addSheet(this.zeroAccountsEdited, 'حسابات صفرية أو فارغة (معدل)');

        // 10. Duplicate Row
        addSheet(this._getLegacyErrorData('duplicate_row', 'السجل'), 'سجلات مكررة بالكامل');

        if (hasSheets) {
            XLSX.writeFile(workbook, filename);
            return true;
        }
        return false;
    }

    exportNidErrors(filename = 'NID_Errors.xlsx') {
        const workbook = XLSX.utils.book_new();
        let hasSheets = false;
        const headers = [...this.originalHeaders, 'نوع الخطأ', 'وصف الخطأ'];

        const addSheet = (data, name) => {
            if (data && data.length > 0) {
                const orderedData = data.map(row => {
                    const ordered = {};
                    headers.forEach(h => ordered[h] = row[h] ?? '');
                    return ordered;
                });
                const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: headers });
                XLSX.utils.book_append_sheet(workbook, worksheet, name);
                hasSheets = true;
            }
        };

        // 1. Nid Conflict
        const nidData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الرقم القومي', 'NationalID']).value;
            return v && this.conflictingNids.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض قومي',
            'وصف الخطأ': `الرقم القومي مكرر مع: (${row._conflictDetailsNid || 'غير محدد'})`
        }));
        addSheet(nidData, 'تكرر رقم قومي');

        // 2. Nid Format
        const formatData = this._getLegacyErrorData('format', 'القومي');
        addSheet(formatData, 'تنسيق خاطئ');

        if (hasSheets) {
            XLSX.writeFile(workbook, filename);
            return true;
        }
        return false;
    }

    exportAccountErrors(filename = 'Account_Errors.xlsx') {
        const workbook = XLSX.utils.book_new();
        let hasSheets = false;
        const headers = [...this.originalHeaders, 'نوع الخطأ', 'وصف الخطأ'];

        const addSheet = (data, name) => {
            if (data && data.length > 0) {
                const orderedData = data.map(row => {
                    const ordered = {};
                    headers.forEach(h => ordered[h] = row[h] ?? '');
                    return ordered;
                });
                const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: headers });
                XLSX.utils.book_append_sheet(workbook, worksheet, name);
                hasSheets = true;
            }
        };

        // 1. Zero Accounts
        addSheet(this.zeroAccountsOriginal, 'حسابات صفرية (أصلي)');
        addSheet(this.zeroAccountsEdited, 'حسابات صفرية (معدل)');

        // 2. Format Errors
        const accFormatOrg = this.errors.filter(errItem =>
            errItem.errors.some(e => e.type === 'format' && e.field === 'رقم الحساب')
        ).map(errItem => ({
            ...errItem.data,
            'نوع الخطأ': 'تنسيق رقم حساب',
            'وصف الخطأ': errItem.errors.filter(e => e.type === 'format' && e.field === 'رقم الحساب').map(e => e.message).join(', ')
        }));
        addSheet(accFormatOrg, 'تنسيق خاطئ (أصلي)');

        const accFormatEdi = this.errors.filter(errItem =>
            errItem.errors.some(e => e.type === 'format' && e.field === 'رقم الحساب المعدل')
        ).map(errItem => ({
            ...errItem.data,
            'نوع الخطأ': 'تنسيق رقم حساب معدل',
            'وصف الخطأ': errItem.errors.filter(e => e.type === 'format' && e.field === 'رقم الحساب المعدل').map(e => e.message).join(', ')
        }));
        addSheet(accFormatEdi, 'تنسيق خاطئ (معدل)');

        // 3. Conflicts (Optional, but included as per request "Account Errors")
        const accOrgData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['رقم الحساب', 'AccountNumber']).value;
            return this.isValidAccount(v) && this.conflictingAccsOriginal.has(String(v).trim());
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض حساب أصلي',
            'وصف الخطأ': `رقم الحساب مكرر مع: (${row._conflictDetailsAccOriginal || 'غير محدد'})`
        }));
        addSheet(accOrgData, 'تكرار (أصلي)');

        const accEdData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['رقم الحساب بعد التعديل', 'EditedAccountNumber']).value;
            return this.isValidAccount(v) && this.conflictingAccsEdited.has(String(v).trim());
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض حساب معدل',
            'وصف الخطأ': `رقم الحساب المعدل مكرر مع: (${row._conflictDetailsAccEdited || 'غير محدد'})`
        }));
        addSheet(accEdData, 'تكرار (معدل)');

        if (hasSheets) {
            XLSX.writeFile(workbook, filename);
            return true;
        }
        return false;
    }

    exportConflictErrors(filename = 'All_Conflicts.xlsx') {
        const workbook = XLSX.utils.book_new();
        let hasSheets = false;
        const headers = [...this.originalHeaders, 'نوع الخطأ', 'وصف الخطأ'];

        const addSheet = (data, name) => {
            if (data && data.length > 0) {
                const orderedData = data.map(row => {
                    const ordered = {};
                    headers.forEach(h => ordered[h] = row[h] ?? '');
                    return ordered;
                });
                const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: headers });
                XLSX.utils.book_append_sheet(workbook, worksheet, name);
                hasSheets = true;
            }
        };

        // 1. Nid Conflict
        const nidData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الرقم القومي', 'NationalID']).value;
            return v && this.conflictingNids.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض قومي',
            'وصف الخطأ': `الرقم القومي مكرر مع: (${row._conflictDetailsNid || 'غير محدد'})`
        }));
        addSheet(nidData, 'تضارب القومي');

        // 2. Acc Original Conflict
        const accOrgData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['رقم الحساب', 'AccountNumber']).value;
            return this.isValidAccount(v) && this.conflictingAccsOriginal.has(String(v).trim());
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض حساب أصلي',
            'وصف الخطأ': `رقم الحساب مكرر مع: (${row._conflictDetailsAccOriginal || 'غير محدد'})`
        }));
        addSheet(accOrgData, 'تضارب الحساب (أصلي)');

        // 3. Acc Edited Conflict
        const accEdData = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['رقم الحساب بعد التعديل', 'EditedAccountNumber']).value;
            return this.isValidAccount(v) && this.conflictingAccsEdited.has(String(v).trim());
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعارض حساب معدل',
            'وصف الخطأ': `رقم الحساب المعدل مكرر مع: (${row._conflictDetailsAccEdited || 'غير محدد'})`
        }));
        addSheet(accEdData, 'تضارب الحساب (معدل)');

        // 4. Multi Acc
        const multiDataOrg = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الاسم', 'Name']).value;
            return v && this.conflictingNamesMultiAccOriginal.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعدد حسابات (أصلي)',
            'وصف الخطأ': `الشخص يمتلك أكثر من حساب أصلي: (${row._conflictDetailsMultiAccOriginal || 'غير محدد'})`
        }));
        addSheet(multiDataOrg, 'تعدد حسابات (أصلي)');

        const multiDataEdi = this.allRecordsWithStatus.filter(r => {
            const v = this.getValue(r, ['الاسم', 'Name']).value;
            return v && this.conflictingNamesMultiAccEdited.has(this.normalize(v));
        }).map(row => ({
            ...row,
            'نوع الخطأ': 'تعدد حسابات (معدل)',
            'وصف الخطأ': `الشخص يمتلك أكثر من حساب معدل: (${row._conflictDetailsMultiAccEdited || 'غير محدد'})`
        }));
        addSheet(multiDataEdi, 'تعدد حسابات (معدل)');

        if (hasSheets) {
            XLSX.writeFile(workbook, filename);
            return true;
        }
        return false;
    }
}
