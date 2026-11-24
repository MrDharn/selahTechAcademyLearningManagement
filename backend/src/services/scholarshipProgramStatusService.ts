import { prismaDatabaseClient } from '../database/prismaDatabaseClient';

const SCHOLARSHIP_PROGRAM_OPEN_SETTING_NAME = 'scholarship_program_open';

/** The scholarship program is open unless an admin has closed it. */
export async function isScholarshipProgramOpen(): Promise<boolean> {
  const storedSetting = await prismaDatabaseClient.platformSetting.findUnique({ where: { settingName: SCHOLARSHIP_PROGRAM_OPEN_SETTING_NAME } });
  return storedSetting ? storedSetting.isEnabled : true;
}

export async function setScholarshipProgramOpen(shouldBeOpen: boolean): Promise<void> {
  await prismaDatabaseClient.platformSetting.upsert({
    where: { settingName: SCHOLARSHIP_PROGRAM_OPEN_SETTING_NAME },
    create: { settingName: SCHOLARSHIP_PROGRAM_OPEN_SETTING_NAME, isEnabled: shouldBeOpen },
    update: { isEnabled: shouldBeOpen },
  });
}
