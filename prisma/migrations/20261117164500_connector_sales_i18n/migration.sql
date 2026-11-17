-- Тексти «продаж зупинено» для англійської і польської версій сторінок гри.
ALTER TABLE "ConnectorSalesSetting" ADD COLUMN "pausedLabelEn" TEXT;
ALTER TABLE "ConnectorSalesSetting" ADD COLUMN "pausedNoteEn" TEXT;
ALTER TABLE "ConnectorSalesSetting" ADD COLUMN "pausedLabelPl" TEXT;
ALTER TABLE "ConnectorSalesSetting" ADD COLUMN "pausedNotePl" TEXT;
