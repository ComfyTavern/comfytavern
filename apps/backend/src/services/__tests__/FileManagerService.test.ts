import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, spyOn } from "bun:test";
import fsPromises from "fs/promises"; // Alias to avoid conflict with fs.Stats
import fs from "node:fs"; // For Stats type
import path from "path";
import os from "os";
import { FileManagerService, FAMService } from "../FileManagerService"; // Adjust path as necessary
import { getProjectRootDir } from "../../utils/fileUtils"; // For constructing expected physical paths

describe("FileManagerService", () => {
  let famService: FAMService;
  let testUserARoot: string;
  let testUserBRoot: string;
  let testSharedRoot: string;
  // let testSystemPublicRoot: string; // 已在外部定义
  // let testSystemDataRoot: string;
  // let testSystemLogsRoot: string;

  // 用于文件操作测试的临时目录
  let tempRootDir: string;
  let tempUserARoot_physical: string; // 物理路径，由 resolvePath mock 返回
  let tempSharedLibraryRoot_physical: string;

  const userIdA = "testUserA";
  const userIdB = "testUserB";

  // 从 FileManagerService 内部获取其实际使用的根路径，用于比较
  // 这需要一种方式来访问 FileManagerService 实例的私有成员或通过一个辅助方法
  // 或者，我们可以根据 getProjectRootDir() 和已知的子目录结构来构建预期的物理路径
  const projectRootDir = getProjectRootDir();
  const expectedUserDataRoot = path.join(projectRootDir, "userData");
  const expectedSharedLibraryRoot = path.join(projectRootDir, "library");
  const expectedSystemPublicRoot = path.join(projectRootDir, "public");
  const expectedSystemDataRoot = path.join(projectRootDir, "data");
  const expectedSystemLogsRoot = path.join(projectRootDir, "logs");

  // const expectedSystemLogsRoot = path.join(projectRootDir, 'logs'); // 已在外部定义

  // resolvePath 的测试目标物理路径 (基于实际项目结构)
  let testUserARoot_resolveTarget: string;
  let testSharedRoot_resolveTarget: string;
  // ... (其他 scheme 的 resolveTarget 可以按需添加)

  // spy 实例的引用，以便在 afterEach 中清理
  let resolvePathSpy: ReturnType<typeof spyOn> | null = null;

  beforeAll(() => {
    famService = new FileManagerService();
    // 用于 resolvePath 测试的期望物理路径
    testUserARoot_resolveTarget = path.join(expectedUserDataRoot, userIdA);
    testSharedRoot_resolveTarget = expectedSharedLibraryRoot;
    // expectedSystemPublicRoot, expectedSystemDataRoot, expectedSystemLogsRoot 已经定义好了
  });

  // 文件操作测试的 setup 和 teardown
  beforeEach(async () => {
    // 创建临时根目录
    tempRootDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "fam-test-"));
    tempUserARoot_physical = path.join(tempRootDir, "user", userIdA);
    tempSharedLibraryRoot_physical = path.join(tempRootDir, "shared", "library");

    await fsPromises.mkdir(tempUserARoot_physical, { recursive: true });
    await fsPromises.mkdir(tempSharedLibraryRoot_physical, { recursive: true });
  });

  afterEach(async () => {
    if (tempRootDir) {
      await fsPromises.rm(tempRootDir, { recursive: true, force: true });
    }
    // 清理通过 spyOn 创建的 mock
    if (resolvePathSpy) {
      resolvePathSpy.mockRestore();
      resolvePathSpy = null;
    }
  });

  describe("resolvePath (using actual paths for verification)", () => {
    // resolvePath 测试保持不变，它们验证的是路径字符串转换逻辑
    it("should resolve user-specific project paths correctly", async () => {
      const logicalPath = "user://projects/myProject/workflow.json";
      const expected = path.join(
        testUserARoot_resolveTarget,
        "projects",
        "myProject",
        "workflow.json"
      );
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected);
    });

    it("should resolve user-specific library paths correctly", async () => {
      const logicalPath = "user://library/templates/myTemplate.json";
      const expected = path.join(
        testUserARoot_resolveTarget,
        "library",
        "templates",
        "myTemplate.json"
      );
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected);
    });

    it("should resolve user-specific knowledgebase paths correctly", async () => {
      const logicalPath = "user://library/knowledgebases/userKb1/doc.txt";
      const expected = path.join(
        testUserARoot_resolveTarget,
        "library",
        "knowledgebases",
        "userKb1",
        "doc.txt"
      );
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected);
    });

    it("should throw error if userId is null for user:// paths", async () => {
      const logicalPath = "user://projects/myProject/workflow.json";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "UserId is required for user:// paths."
      );
    });

    it("should resolve shared library workflow paths correctly", async () => {
      const logicalPath = "shared://library/workflows/template.json";
      const expected = path.join(testSharedRoot_resolveTarget, "workflows", "template.json");
      await expect(famService.resolvePath(null, logicalPath)).resolves.toBe(expected);
    });

    it("should resolve shared library knowledgebase paths correctly", async () => {
      const logicalPath = "shared://library/knowledgebases/sharedKb1/data.json";
      const expected = path.join(
        testSharedRoot_resolveTarget,
        "knowledgebases",
        "sharedKb1",
        "data.json"
      );
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected); // userId should be ignored
    });

    it("should throw error for shared paths not starting with library/", async () => {
      const logicalPath = "shared://other/resource.json";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "Invalid shared path: shared://other/resource.json. Must start with shared://library/"
      );
    });

    it("should resolve system public paths correctly", async () => {
      const logicalPath = "system://public/assets/image.png";
      const expected = path.join(expectedSystemPublicRoot, "assets", "image.png");
      await expect(famService.resolvePath(null, logicalPath)).resolves.toBe(expected);
    });

    it("should resolve system data paths correctly", async () => {
      const logicalPath = "system://data/database.db";
      const expected = path.join(expectedSystemDataRoot, "database.db");
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected); // userId should be ignored
    });

    it("should resolve system logs paths correctly", async () => {
      const logicalPath = "system://logs/app.log";
      const expected = path.join(expectedSystemLogsRoot, "app.log");
      await expect(famService.resolvePath(null, logicalPath)).resolves.toBe(expected);
    });

    it("should throw error for unknown system area", async () => {
      const logicalPath = "system://unknown_area/file.txt";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "Unknown system area in logical path: system://unknown_area/file.txt"
      );
    });

    it("should throw error for invalid logical path format", async () => {
      const logicalPath = "invalidpath";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "Invalid logical path format: invalidpath. Expected scheme://path"
      );
    });

    it("should throw error for unknown scheme", async () => {
      const logicalPath = "unknown_scheme://data/file.txt";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "Unknown scheme in logicalPath: unknown_scheme"
      );
    });

    it("should prevent path traversal upwards from user root", async () => {
      const logicalPath = "user://../../../../etc/passwd";
      await expect(famService.resolvePath(userIdA, logicalPath)).rejects.toThrow(
        "Path traversal attempt detected"
      );
    });

    it("should prevent path traversal with encoded chars (basic check, more robust checks might be needed)", async () => {
      const logicalPath = "user://projects/myProject/..%2F..%2Fsecrets.txt";
      await expect(famService.resolvePath(userIdA, logicalPath)).rejects.toThrow(
        "Path traversal attempt detected"
      );
    });

    it("should handle paths with multiple slashes correctly", async () => {
      const logicalPath = "user://projects///myProject////workflow.json";
      const expected = path.join(
        testUserARoot_resolveTarget,
        "projects",
        "myProject",
        "workflow.json"
      );
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected);
    });

    it("should handle paths with trailing slashes correctly for directories", async () => {
      const logicalPath = "user://projects/myProject/";
      const expected = path.join(testUserARoot_resolveTarget, "projects", "myProject");
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected);
    });

    it("should handle empty path part after scheme for user root", async () => {
      const logicalPath = "user://";
      const expected = testUserARoot_resolveTarget;
      await expect(famService.resolvePath(userIdA, logicalPath)).resolves.toBe(expected);
    });

    it("should handle empty path part after scheme for shared root", async () => {
      const logicalPath = "shared://library/";
      const expected = testSharedRoot_resolveTarget;
      await expect(famService.resolvePath(null, logicalPath)).resolves.toBe(expected);

      const logicalPath2 = "shared://library";
      await expect(famService.resolvePath(null, logicalPath2)).resolves.toBe(expected);
    });

    it("should throw for shared path without library prefix even if empty", async () => {
      const logicalPath = "shared://";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "Invalid shared path"
      );
    });

    it("should handle empty path part after scheme for system area (e.g. system public root)", async () => {
      const logicalPath = "system://public/";
      const expected = expectedSystemPublicRoot;
      await expect(famService.resolvePath(null, logicalPath)).resolves.toBe(expected);

      const logicalPath2 = "system://public";
      await expect(famService.resolvePath(null, logicalPath2)).resolves.toBe(expected);
    });

    it("should throw for system path without area (e.g. system://)", async () => {
      const logicalPath = "system://";
      await expect(famService.resolvePath(null, logicalPath)).rejects.toThrow(
        "Unknown system area"
      );
    });
  });

  describe("exists", () => {
    it("should return true if a file exists at user path", async () => {
      const logicalPath = "user://existing-file.txt";
      const physicalFilePath = path.join(tempUserARoot_physical, "existing-file.txt");
      await fsPromises.writeFile(physicalFilePath, "content");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);

      await expect(famService.exists(userIdA, logicalPath)).resolves.toBe(true);
    });

    it("should return true if a directory exists at user path", async () => {
      const logicalPath = "user://existing-dir";
      const physicalDirPath = path.join(tempUserARoot_physical, "existing-dir");
      await fsPromises.mkdir(physicalDirPath);

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalDirPath);

      await expect(famService.exists(userIdA, logicalPath)).resolves.toBe(true);
    });

    it("should return false if path does not exist", async () => {
      const logicalPath = "user://non-existing-file.txt";
      const physicalFilePath = path.join(tempUserARoot_physical, "non-existing-file.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);

      await expect(famService.exists(userIdA, logicalPath)).resolves.toBe(false);
    });

    it("should return false if resolvePath throws an error (e.g. invalid path)", async () => {
      const logicalPath = "invalid-scheme://somepath";
      // Mock resolvePath to throw an error similar to how the actual method would
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValue(
        new Error("Unknown scheme in logicalPath: invalid-scheme")
      );

      await expect(famService.exists(userIdA, logicalPath)).resolves.toBe(false);
    });
  });

  describe("readFile", () => {
    it("should read file content correctly for user path (utf-8)", async () => {
      const logicalPath = "user://test-read.txt";
      const fileContent = "Hello from readFile test!";
      const physicalFilePath = path.join(tempUserARoot_physical, "test-read.txt");
      await fsPromises.writeFile(physicalFilePath, fileContent, "utf-8");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      // Mock exists as well, since readFile calls it internally
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(true);

      const content = await famService.readFile(userIdA, logicalPath, "utf-8");
      expect(content).toBe(fileContent);
      existsSpy.mockRestore();
    });

    it("should read file content correctly as Buffer for user path (binary)", async () => {
      const logicalPath = "user://test-read-binary.bin";
      const fileContent = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const physicalFilePath = path.join(tempUserARoot_physical, "test-read-binary.bin");
      await fsPromises.writeFile(physicalFilePath, fileContent);

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(true);

      const content = await famService.readFile(userIdA, logicalPath, "binary");
      expect(content).toEqual(fileContent);
      existsSpy.mockRestore();
    });

    it("should throw error if file does not exist (via internal exists call)", async () => {
      const logicalPath = "user://non-existing-read.txt";
      const physicalFilePath = path.join(tempUserARoot_physical, "non-existing-read.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      // Mock exists to return false
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(false);

      await expect(famService.readFile(userIdA, logicalPath)).rejects.toThrow(
        "File not found at logical path: user://non-existing-read.txt"
      );
      existsSpy.mockRestore();
    });

    it("should re-throw error from resolvePath if it fails", async () => {
      const logicalPath = "user://unresolvable.txt";
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValue(
        new Error("Test resolvePath error")
      );
      // exists will not be called if resolvePath fails first in the actual implementation of readFile

      await expect(famService.readFile(userIdA, logicalPath)).rejects.toThrow(
        "Test resolvePath error"
      );
    });

    it("should throw error if fs.readFile itself fails for other reasons", async () => {
      const logicalPath = "user://read-fail-permission.txt";
      const physicalFilePath = path.join(tempUserARoot_physical, "read-fail-permission.txt");
      await fsPromises.writeFile(physicalFilePath, "content"); // File exists

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(true);

      // Mock fsPromises.readFile to simulate a permission error or other fs error
      const fsReadFileSpy = spyOn(fsPromises, "readFile").mockRejectedValue(
        new Error("FS: Permission denied")
      );

      await expect(famService.readFile(userIdA, logicalPath)).rejects.toThrow(
        "FS: Permission denied"
      );

      existsSpy.mockRestore();
      fsReadFileSpy.mockRestore();
    });
  });

  describe("writeFile", () => {
    let ensurePhysicalDirExistsSpy: ReturnType<typeof spyOn> | null = null;

    beforeEach(() => {
      // FileManagerService._ensurePhysicalDirExists 是私有的，但我们可以 spyOn 它
      // 或者，我们可以验证其效果，即目录被创建。
      // 为了更直接地测试 writeFile 的逻辑，我们可以 mock 它。
      // 注意：spyOn 在 Bun Test 中可以直接用于类的原型方法。
      ensurePhysicalDirExistsSpy = spyOn(
        FileManagerService.prototype as any,
        "_ensurePhysicalDirExists"
      ).mockResolvedValue(undefined);
    });

    afterEach(() => {
      ensurePhysicalDirExistsSpy?.mockRestore();
    });

    it("should write file content correctly for a new file (user path)", async () => {
      const logicalPath = "user://new-write-file.txt";
      // const logicalPath = 'user://new-write-file.txt'; // Removed duplicate declaration
      const fileContent = "Content to be written!";
      const physicalFilePath = path.join(tempUserARoot_physical, "new-write-file.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(false); // File does not exist initially

      await famService.writeFile(userIdA, logicalPath, fileContent);

      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(physicalFilePath);
      const writtenContent = await fsPromises.readFile(physicalFilePath, "utf-8");
      expect(writtenContent).toBe(fileContent);

      existsSpy.mockRestore();
    });

    it("should overwrite an existing file if overwrite is true (default)", async () => {
      const logicalPath = "user://overwrite-me.txt";
      const initialContent = "Initial content.";
      const newContent = "Overwritten content!";
      const physicalFilePath = path.join(tempUserARoot_physical, "overwrite-me.txt");

      await fsPromises.writeFile(physicalFilePath, initialContent, "utf-8"); // Pre-populate the file

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      // exists will be called by writeFile if overwrite is false, but not strictly necessary to mock if true
      // For safety, let's assume it might be called.
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(true);

      await famService.writeFile(userIdA, logicalPath, newContent, { overwrite: true });

      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(physicalFilePath);
      const writtenContent = await fsPromises.readFile(physicalFilePath, "utf-8");
      expect(writtenContent).toBe(newContent);
      existsSpy.mockRestore();
    });

    it("should throw error if file exists and overwrite is false", async () => {
      const logicalPath = "user://no-overwrite.txt";
      const initialContent = "Do not overwrite.";
      const physicalFilePath = path.join(tempUserARoot_physical, "no-overwrite.txt");

      await fsPromises.writeFile(physicalFilePath, initialContent, "utf-8");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(true); // File exists

      await expect(
        famService.writeFile(userIdA, logicalPath, "new data", { overwrite: false })
      ).rejects.toThrow(
        `File already exists at logical path: ${logicalPath} and overwrite is false.`
      );

      // Verify file was not changed
      const contentAfterAttempt = await fsPromises.readFile(physicalFilePath, "utf-8");
      expect(contentAfterAttempt).toBe(initialContent);
      existsSpy.mockRestore();
    });

    it("should write a new file if overwrite is false and file does not exist", async () => {
      const logicalPath = "user://new-file-no-overwrite.txt";
      const fileContent = "Written because no overwrite and new.";
      const physicalFilePath = path.join(tempUserARoot_physical, "new-file-no-overwrite.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(false); // File does not exist

      await famService.writeFile(userIdA, logicalPath, fileContent, { overwrite: false });

      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(physicalFilePath);
      const writtenContent = await fsPromises.readFile(physicalFilePath, "utf-8");
      expect(writtenContent).toBe(fileContent);
      existsSpy.mockRestore();
    });

    it("should use specified encoding (e.g., binary)", async () => {
      const logicalPath = "user://binary-write.bin";
      const fileContent = Buffer.from([0x05, 0x06, 0x07]);
      const physicalFilePath = path.join(tempUserARoot_physical, "binary-write.bin");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      const existsSpy = spyOn(famService, "exists").mockResolvedValue(false);

      await famService.writeFile(userIdA, logicalPath, fileContent, { encoding: "binary" });

      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(physicalFilePath);
      const writtenContent = await fsPromises.readFile(physicalFilePath); // Read as buffer
      expect(writtenContent).toEqual(fileContent);
      existsSpy.mockRestore();
    });

    it("should re-throw error from resolvePath if it fails", async () => {
      const logicalPath = "user://unresolvable-write.txt";
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValue(
        new Error("Write resolvePath error")
      );

      await expect(famService.writeFile(userIdA, logicalPath, "data")).rejects.toThrow(
        "Write resolvePath error"
      );
    });
  });

  describe("createDir", () => {
    let fsStatSpy: ReturnType<typeof spyOn> | null = null;
    let fsMkdirSpy: ReturnType<typeof spyOn> | null = null;

    beforeEach(() => {
      // Spy on fsPromises.stat and fsPromises.mkdir to control their behavior and check calls
      fsStatSpy = spyOn(fsPromises, "stat");
      fsMkdirSpy = spyOn(fsPromises, "mkdir").mockResolvedValue(undefined); // Default mock for successful creation
    });

    afterEach(() => {
      fsStatSpy?.mockRestore();
      fsMkdirSpy?.mockRestore();
    });

    it("should create a directory if it does not exist", async () => {
      const logicalPath = "user://new-directory";
      const physicalDirPath = path.join(tempUserARoot_physical, "new-directory");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalDirPath);
      fsStatSpy!.mockRejectedValue({ code: "ENOENT" }); // Simulate directory does not exist

      await famService.createDir(userIdA, logicalPath);

      expect(fsMkdirSpy).toHaveBeenCalledWith(physicalDirPath, { recursive: true });
      // Optionally, verify by actually checking the temp file system if not fully mocking fsPromises.mkdir
      // const dirExists = await fsPromises.stat(physicalDirPath).then(s => s.isDirectory()).catch(() => false);
      // expect(dirExists).toBe(true);
    });

    it("should do nothing if directory already exists", async () => {
      const logicalPath = "user://existing-dir-for-create";
      const physicalDirPath = path.join(tempUserARoot_physical, "existing-dir-for-create");

      // Simulate directory already exists
      await fsPromises.mkdir(physicalDirPath, { recursive: true }); // Create it for real in temp

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalDirPath);
      // fsStatSpy will be called by the actual implementation. We don't need to mock its success here
      // as the actual fsPromises.stat will succeed.

      await famService.createDir(userIdA, logicalPath);

      expect(fsMkdirSpy).not.toHaveBeenCalled(); // mkdir should not be called
    });

    it("should throw error if path exists and is a file", async () => {
      const logicalPath = "user://existing-file-for-create-dir";
      const physicalFilePath = path.join(tempUserARoot_physical, "existing-file-for-create-dir");
      await fsPromises.writeFile(physicalFilePath, "i am a file"); // Create a file at the path

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
      // fsStatSpy will be called by the actual implementation.

      await expect(famService.createDir(userIdA, logicalPath)).rejects.toThrow(
        `Cannot create directory: A file already exists at logical path ${logicalPath}`
      );
      expect(fsMkdirSpy).not.toHaveBeenCalled();
    });

    it("should re-throw error from resolvePath if it fails", async () => {
      const logicalPath = "user://unresolvable-create-dir";
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValue(
        new Error("CreateDir resolvePath error")
      );

      await expect(famService.createDir(userIdA, logicalPath)).rejects.toThrow(
        "CreateDir resolvePath error"
      );
      expect(fsMkdirSpy).not.toHaveBeenCalled();
    });

    it("should throw if fsPromises.stat fails for reasons other than ENOENT", async () => {
      const logicalPath = "user://stat-fail-dir";
      const physicalDirPath = path.join(tempUserARoot_physical, "stat-fail-dir");
      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalDirPath);
      fsStatSpy!.mockRejectedValue(new Error("FS: Permission denied on stat"));

      await expect(famService.createDir(userIdA, logicalPath)).rejects.toThrow(
        "FS: Permission denied on stat"
      );
      expect(fsMkdirSpy).not.toHaveBeenCalled();
    });
  });

  describe("listDir", () => {
    let fsStatSpy: ReturnType<typeof spyOn> | null = null;
    describe("listDir", () => {
      let fsStatSpy: ReturnType<typeof spyOn> | null = null;
      // fsPromises.readdir will operate on the actual temp directory

      beforeEach(() => {
        // We only need to mock fsPromises.stat for the parent directory to confirm it's a directory.
        // Child stats will be read by the listDir implementation using the original fsPromises.stat.
        fsStatSpy = spyOn(fsPromises, "stat");
      });

      afterEach(() => {
        fsStatSpy?.mockRestore();
      });

      it("should list directory contents correctly", async () => {
        const logicalParentDirPath = "user://list-test-dir";
        const physicalParentDirPath = path.join(tempUserARoot_physical, "list-test-dir");
        await fsPromises.mkdir(physicalParentDirPath, { recursive: true });

        const file1Path = path.join(physicalParentDirPath, "file1.txt");
        await fsPromises.writeFile(file1Path, "content1");
        const subdir1Path = path.join(physicalParentDirPath, "subdir1");
        await fsPromises.mkdir(subdir1Path);
        await fsPromises.writeFile(path.join(subdir1Path, "nestedfile.txt"), "nested");

        resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalParentDirPath);

        // Mock fsPromises.stat only for the parent directory path to confirm it's a directory
        fsStatSpy!.mockImplementation(async (pPath: string | Buffer | URL): Promise<fs.Stats> => {
          if (pPath === physicalParentDirPath) {
            // Return a stat object indicating it's a directory
            return {
              isDirectory: () => true,
              isFile: () => false,
              size: 0,
              mtime: new Date(),
              // Add other fs.Stats properties with dummy values if strict type checking requires them
              atime: new Date(),
              birthtime: new Date(),
              blksize: 4096,
              blocks: 8,
              ctime: new Date(),
              dev: 0,
              gid: 0,
              ino: 0,
              mode: 0,
              nlink: 0,
              rdev: 0,
              uid: 0,
              isBlockDevice: () => false,
              isCharacterDevice: () => false,
              isFIFO: () => false,
              isSocket: () => false,
              isSymbolicLink: () => false,
            } as fs.Stats;
          }
          // For other paths, let the original implementation (or lack thereof if fully mocked) handle it.
          // This specific mock is only for the parent directory check.
          // If we need to call the original for other paths:
          const originalFsModule = await import("node:fs/promises");
          return originalFsModule.stat(pPath as fs.PathLike); // Corrected to fs.PathLike
        });

        const items = await famService.listDir(userIdA, logicalParentDirPath);

        expect(items).toHaveLength(2);

        const file1 = items.find((item) => item.name === "file1.txt");
        expect(file1).toBeDefined();
        expect(file1?.itemType).toBe("file");
        expect(file1?.logicalPath).toBe("user://list-test-dir/file1.txt");
        const file1Stats = await fsPromises.stat(file1Path); // Get actual stats for comparison
        expect(file1?.size).toBe(file1Stats.size);
        expect(file1?.lastModified).toBeCloseTo(file1Stats.mtime.getTime(), -2); // Compare time, allow slight diff

        const subdir1 = items.find((item) => item.name === "subdir1");
        expect(subdir1).toBeDefined();
        expect(subdir1?.itemType).toBe("directory");
        expect(subdir1?.logicalPath).toBe("user://list-test-dir/subdir1");
        // For directories, size and lastModified might be undefined or platform-dependent from our ListItem perspective
      });

      it("should return an empty array for an empty directory", async () => {
        const logicalEmptyDirPath = "user://empty-list-dir";
        const physicalEmptyDirPath = path.join(tempUserARoot_physical, "empty-list-dir");
        await fsPromises.mkdir(physicalEmptyDirPath, { recursive: true });

        resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalEmptyDirPath);
        fsStatSpy!.mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtime: new Date(),
        } as fs.Stats);

        const items = await famService.listDir(userIdA, logicalEmptyDirPath);
        expect(items).toEqual([]);
      });

      it("should throw error if logical path is not a directory", async () => {
        const logicalFilePath = "user://list-a-file.txt";
        const physicalFilePath = path.join(tempUserARoot_physical, "list-a-file.txt");
        await fsPromises.writeFile(physicalFilePath, "content");

        resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalFilePath);
        fsStatSpy!.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true,
          size: 0,
          mtime: new Date(),
        } as fs.Stats);

        await expect(famService.listDir(userIdA, logicalFilePath)).rejects.toThrow(
          `Not a directory at logical path: ${logicalFilePath}`
        );
      });

      it("should throw error if logical path does not exist", async () => {
        const logicalNonExistentPath = "user://list-non-existent";
        const physicalNonExistentPath = path.join(tempUserARoot_physical, "list-non-existent");

        resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(
          physicalNonExistentPath
        );
        fsStatSpy!.mockRejectedValue({ code: "ENOENT" });

        await expect(famService.listDir(userIdA, logicalNonExistentPath)).rejects.toThrow(
          `Directory not found at logical path: ${logicalNonExistentPath}`
        );
      }); // Closes 'it' for non-existent path in inner describe
    }); // Closes inner describe('listDir')
    it("should re-throw error from resolvePath if it fails", async () => {
      const logicalPath = "user://unresolvable-list-dir";
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValue(
        new Error("ListDir resolvePath error")
      );

      await expect(famService.listDir(userIdA, logicalPath)).rejects.toThrow(
        "ListDir resolvePath error"
      );
    });
  }); // Closes describe('listDir')
  describe("delete", () => {
    let fsStatSpy: ReturnType<typeof spyOn> | null = null;
    let fsRmSpy: ReturnType<typeof spyOn> | null = null;
    // let fsRmdirSpy: ReturnType<typeof spyOn> | null = null; // For older Node versions if recursive rm isn't used/available

    beforeEach(() => {
      fsStatSpy = spyOn(fsPromises, "stat");
      // For Node.js v14.14.0+ fs.rm is preferred for both files and directories (with recursive: true)
      fsRmSpy = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
      // fsRmdirSpy = spyOn(fsPromises, 'rmdir'); // Only if testing non-recursive or older Node logic
    });

    afterEach(() => {
      fsStatSpy?.mockRestore();
      fsRmSpy?.mockRestore();
      // fsRmdirSpy?.mockRestore();
    });

    it("should delete a file successfully", async () => {
      const logicalPath = "user://to-be-deleted.txt";
      const physicalPath = path.join(tempUserARoot_physical, "to-be-deleted.txt");

      // Simulate file exists and is a file
      // No need to actually create it in temp if we mock stat and rm
      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      fsStatSpy!.mockResolvedValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);

      await famService.delete(userIdA, logicalPath);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, logicalPath);
      expect(fsStatSpy).toHaveBeenCalledWith(physicalPath);
      expect(fsRmSpy).toHaveBeenCalledWith(physicalPath, { recursive: false, force: false }); // FAMService delete is not recursive by default for files
    });

    it("should delete a directory successfully (non-recursive by default in FAMService)", async () => {
      const logicalPath = "user://empty-dir-to-delete";
      const physicalPath = path.join(tempUserARoot_physical, "empty-dir-to-delete");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      fsStatSpy!.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as fs.Stats);
      // fs.rm can delete empty directories without recursive option

      await famService.delete(userIdA, logicalPath);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, logicalPath);
      expect(fsStatSpy).toHaveBeenCalledWith(physicalPath);
      expect(fsRmSpy).toHaveBeenCalledWith(physicalPath, { recursive: false, force: false });
    });

    it("should delete a directory and its contents if recursive is true", async () => {
      const logicalPath = "user://dir-to-delete-recursively";
      const physicalPath = path.join(tempUserARoot_physical, "dir-to-delete-recursively");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      // For recursive delete, FAMService might not call stat first, or it might.
      // Assuming it does to check existence before attempting rm.
      fsStatSpy!.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as fs.Stats);

      await famService.delete(userIdA, logicalPath, { recursive: true });

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, logicalPath);
      // fsStatSpy might or might not be called depending on implementation detail for recursive.
      // Let's assume it is for now. If delete directly calls rm with recursive, stat might be skipped.
      // The current FAMService.delete implementation calls this.exists, which calls resolvePath then fs.stat.
      expect(fsStatSpy).toHaveBeenCalledWith(physicalPath);
      expect(fsRmSpy).toHaveBeenCalledWith(physicalPath, { recursive: true, force: false });
    });

    it("should throw error if path does not exist", async () => {
      const logicalPath = "user://non-existent-for-delete.txt";
      const physicalPath = path.join(tempUserARoot_physical, "non-existent-for-delete.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      fsStatSpy!.mockRejectedValue({ code: "ENOENT" }); // Simulate path does not exist

      await expect(famService.delete(userIdA, logicalPath)).rejects.toThrow(
        `Path not found at logical path: ${logicalPath}`
      );

      expect(fsRmSpy).not.toHaveBeenCalled();
    });

    it("should re-throw error from resolvePath if it fails", async () => {
      const logicalPath = "user://unresolvable-delete.txt";
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValue(
        new Error("Delete resolvePath error")
      );

      await expect(famService.delete(userIdA, logicalPath)).rejects.toThrow(
        "Delete resolvePath error"
      );
      expect(fsStatSpy).not.toHaveBeenCalled();
      expect(fsRmSpy).not.toHaveBeenCalled();
    });

    it("should throw if fs.rm fails for other reasons (e.g., permissions)", async () => {
      const logicalPath = "user://delete-permission-denied.txt";
      const physicalPath = path.join(tempUserARoot_physical, "delete-permission-denied.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      fsStatSpy!.mockResolvedValue({ isDirectory: () => false, isFile: () => true } as fs.Stats); // Simulate file exists
      fsRmSpy!.mockRejectedValue(new Error("FS: Permission denied on rm"));

      await expect(famService.delete(userIdA, logicalPath)).rejects.toThrow(
        "FS: Permission denied on rm"
      );
    });

    it("should use force option if specified", async () => {
      const logicalPath = "user://force-delete-file.txt";
      const physicalPath = path.join(tempUserARoot_physical, "force-delete-file.txt");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      fsStatSpy!.mockResolvedValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);

      await famService.delete(userIdA, logicalPath, { force: true });

      expect(fsRmSpy).toHaveBeenCalledWith(physicalPath, { recursive: false, force: true });
    });

    it("should use force and recursive options if specified for a directory", async () => {
      const logicalPath = "user://force-recursive-delete-dir";
      const physicalPath = path.join(tempUserARoot_physical, "force-recursive-delete-dir");

      resolvePathSpy = spyOn(famService, "resolvePath").mockResolvedValue(physicalPath);
      fsStatSpy!.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as fs.Stats);

      await famService.delete(userIdA, logicalPath, { recursive: true, force: true });

      expect(fsRmSpy).toHaveBeenCalledWith(physicalPath, { recursive: true, force: true });
    });
  });
  // TODO: Add tests for move
  describe("move", () => {
    let ensurePhysicalDirExistsSpy: ReturnType<typeof spyOn> | null = null;
    let fsRenameSpy: ReturnType<typeof spyOn> | null = null;
    let existsSpy: ReturnType<typeof spyOn> | null = null; // For source and destination

    beforeEach(() => {
      // Spy on the private method _ensurePhysicalDirExists
      ensurePhysicalDirExistsSpy = spyOn(
        FileManagerService.prototype as any,
        "_ensurePhysicalDirExists"
      ).mockResolvedValue(undefined);
      fsRenameSpy = spyOn(fsPromises, "rename").mockResolvedValue(undefined); // Mock successful rename
      // exists will be spied on a case-by-case basis or with more specific mockImplementations

      // Reset resolvePathSpy as it's used and potentially re-mocked in each 'move' test
      // It's declared in the outer scope.
      if (resolvePathSpy) {
        resolvePathSpy.mockRestore();
        resolvePathSpy = null;
      }
    });

    afterEach(() => {
      ensurePhysicalDirExistsSpy?.mockRestore();
      fsRenameSpy?.mockRestore();
      existsSpy?.mockRestore(); // Ensure this is restored if set
      // resolvePathSpy is restored in its own beforeEach or within the test if locally mocked
    });

    it("should move a file to a new location successfully", async () => {
      const sourceLogicalPath = "user://source-file-to-move.txt";
      const destinationLogicalPath = "user://subdir/destination-file-moved.txt";

      const sourcePhysicalPath = path.join(tempUserARoot_physical, "source-file-to-move.txt");
      const destinationPhysicalPath = path.join(
        tempUserARoot_physical,
        "subdir",
        "destination-file-moved.txt"
      );
      // const destinationPhysicalParentDir = path.join(tempUserARoot_physical, 'subdir'); // Not directly used in expect for ensurePhysicalDirExistsSpy with current mock

      // Create a dummy source file in the temp directory to be "moved" by fs.rename
      // For this unit test, we don't strictly need to create the file if fs.rename is fully mocked.
      // However, it's good practice for integration-style unit tests or if we later decide to test the actual fs operation.
      // await fsPromises.writeFile(sourcePhysicalPath, 'content to move');

      // Mocking resolvePath:
      // It will be called twice: once for source, once for destination.
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath) // First call for source
        .mockResolvedValueOnce(destinationPhysicalPath); // Second call for destination

      // Mocking exists:
      // Called for source (true), then for destination (false for this test case).
      existsSpy = spyOn(famService, "exists")
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(false); // Destination does not exist

      await famService.move(userIdA, sourceLogicalPath, destinationLogicalPath);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      // In FileManagerService.move, the call to this.exists for destination is:
      // const destinationExists = await this.exists(userId, destinationLogicalPath, true);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath, true);
      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(destinationPhysicalPath);
      expect(fsRenameSpy).toHaveBeenCalledWith(sourcePhysicalPath, destinationPhysicalPath);

      // To verify actual file system changes, fsRenameSpy should not be mocked or call the original.
      // For this unit test, we primarily check if the correct functions were called with correct arguments.
      // If fsPromises.writeFile was used above, and fsRenameSpy was NOT mocked (or called original):
      // await expect(fsPromises.access(sourcePhysicalPath)).rejects.toThrow();
      // const destContent = await fsPromises.readFile(destinationPhysicalPath, 'utf-8');
      // expect(destContent).toBe('content to move');
    });
    it("should move a directory to a new location successfully", async () => {
      const sourceLogicalPath = "user://source-dir-to-move";
      const destinationLogicalPath = "user://new-parent/destination-dir-moved";

      const sourcePhysicalPath = path.join(tempUserARoot_physical, "source-dir-to-move");
      const destinationPhysicalPath = path.join(
        tempUserARoot_physical,
        "new-parent",
        "destination-dir-moved"
      );

      // Mocking resolvePath
      // Ensure resolvePathSpy is fresh for this test if it's defined in an outer scope and reused.
      // The beforeEach for 'move' should handle restoring/nullifying it.
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath)
        .mockResolvedValueOnce(destinationPhysicalPath);

      // Mocking exists
      // Source directory exists, destination does not.
      existsSpy = spyOn(famService, "exists")
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(false); // Destination does not exist

      await famService.move(userIdA, sourceLogicalPath, destinationLogicalPath);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath, true);
      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(destinationPhysicalPath);
      expect(fsRenameSpy).toHaveBeenCalledWith(sourcePhysicalPath, destinationPhysicalPath);
    });
    it("should move a file, overwriting an existing file at destination if overwrite is true", async () => {
      const sourceLogicalPath = "user://source-to-overwrite.txt";
      const destinationLogicalPath = "user://existing-destination-to-be-overwritten.txt";

      const sourcePhysicalPath = path.join(tempUserARoot_physical, "source-to-overwrite.txt");
      const destinationPhysicalPath = path.join(
        tempUserARoot_physical,
        "existing-destination-to-be-overwritten.txt"
      );

      // Mocking resolvePath
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath)
        .mockResolvedValueOnce(destinationPhysicalPath);

      // Mocking exists: Source exists, Destination also exists
      existsSpy = spyOn(famService, "exists")
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(true); // Destination exists

      await famService.move(userIdA, sourceLogicalPath, destinationLogicalPath, {
        overwrite: true,
      });

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath, true); // skipCache = true
      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(destinationPhysicalPath);
      expect(fsRenameSpy).toHaveBeenCalledWith(sourcePhysicalPath, destinationPhysicalPath);
    });
    it("should throw error if destination exists and overwrite is false", async () => {
      const sourceLogicalPath = "user://source-for-no-overwrite.txt";
      const destinationLogicalPath = "user://existing-destination-no-overwrite.txt";

      const sourcePhysicalPath = path.join(tempUserARoot_physical, "source-for-no-overwrite.txt");
      const destinationPhysicalPath = path.join(
        tempUserARoot_physical,
        "existing-destination-no-overwrite.txt"
      );

      // Mocking resolvePath
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath)
        .mockResolvedValueOnce(destinationPhysicalPath);

      // Mocking exists: Source exists, Destination also exists
      existsSpy = spyOn(famService, "exists")
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(true); // Destination exists

      await expect(
        famService.move(userIdA, sourceLogicalPath, destinationLogicalPath, { overwrite: false })
      ).rejects.toThrow(
        `Destination path already exists: ${destinationLogicalPath} and overwrite is false.`
      );

      // Verify dependent functions were not called if an error is thrown early
      expect(ensurePhysicalDirExistsSpy).not.toHaveBeenCalled();
      expect(fsRenameSpy).not.toHaveBeenCalled();
    });
    it("should throw error if source path does not exist", async () => {
      const sourceLogicalPath = "user://non-existent-source.txt";
      const destinationLogicalPath = "user://any-destination.txt";

      const sourcePhysicalPath = path.join(tempUserARoot_physical, "non-existent-source.txt");
      // Destination physical path doesn't strictly matter as the function should fail before using it
      const destinationPhysicalPath = path.join(tempUserARoot_physical, "any-destination.txt");

      // Mocking resolvePath for source. Destination resolve might not be reached if source check fails first.
      // However, the current implementation resolves both paths before checking source existence.
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath)
        .mockResolvedValueOnce(destinationPhysicalPath);

      // Mocking exists: Source does NOT exist
      // famService.move first calls this.exists(userId, sourceLogicalPath)
      existsSpy = spyOn(famService, "exists").mockResolvedValueOnce(false);

      await expect(
        famService.move(userIdA, sourceLogicalPath, destinationLogicalPath)
      ).rejects.toThrow(`Source path does not exist: ${sourceLogicalPath}`);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      // existsSpy should have been called for the source path.
      expect(existsSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(existsSpy).toHaveBeenCalledTimes(1); // Only called for source

      // These should not be called if source doesn't exist
      expect(ensurePhysicalDirExistsSpy).not.toHaveBeenCalled();
      expect(fsRenameSpy).not.toHaveBeenCalled();
    });
    it("should move a file to a destination creating parent directories if they do not exist", async () => {
      const sourceLogicalPath = "user://source-needs-parent-created.txt";
      const destinationLogicalPath = "user://new-parent-dir/new-subdir/dest-file.txt";

      const sourcePhysicalPath = path.join(
        tempUserARoot_physical,
        "source-needs-parent-created.txt"
      );
      const destinationPhysicalPath = path.join(
        tempUserARoot_physical,
        "new-parent-dir",
        "new-subdir",
        "dest-file.txt"
      );

      // Mocking resolvePath
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath)
        .mockResolvedValueOnce(destinationPhysicalPath);

      // Mocking exists: Source exists, Destination does not
      existsSpy = spyOn(famService, "exists")
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(false); // Destination does not exist

      // ensurePhysicalDirExistsSpy is already set up in beforeEach to mockResolvedValue(undefined)
      // fsRenameSpy is also set up in beforeEach to mockResolvedValue(undefined)

      await famService.move(userIdA, sourceLogicalPath, destinationLogicalPath);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath, true);
      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(destinationPhysicalPath); // Key check for this test
      expect(fsRenameSpy).toHaveBeenCalledWith(sourcePhysicalPath, destinationPhysicalPath);
    });
    it("should throw error if resolvePath fails for the source path", async () => {
      const sourceLogicalPath = "user://unresolvable-source.txt";
      const destinationLogicalPath = "user://any-dest.txt";
      const resolveError = new Error("Source resolvePath failed");

      // Mocking resolvePath to fail for the source
      // resolvePathSpy is reset in beforeEach of the 'move' describe block
      resolvePathSpy = spyOn(famService, "resolvePath").mockRejectedValueOnce(resolveError);

      await expect(
        famService.move(userIdA, sourceLogicalPath, destinationLogicalPath)
      ).rejects.toThrow(resolveError);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledTimes(1); // Should not attempt to resolve destination

      // existsSpy is declared in the 'move' describe block's scope but might not be initialized
      // if the test path doesn't reach a point where it's spied on.
      // So, check if it was called only if it was initialized (i.e., not null).
      if (existsSpy) {
        expect(existsSpy).not.toHaveBeenCalled();
      }

      expect(ensurePhysicalDirExistsSpy).not.toHaveBeenCalled();
      expect(fsRenameSpy).not.toHaveBeenCalled();
    });
    it("should throw error if resolvePath fails for the destination path", async () => {
      const sourceLogicalPath = "user://source-for-dest-resolve-fail.txt";
      const destinationLogicalPath = "user://unresolvable-destination.txt";

      const sourcePhysicalPath = path.join(
        tempUserARoot_physical,
        "source-for-dest-resolve-fail.txt"
      );
      const resolveError = new Error("Destination resolvePath failed");

      // Mocking resolvePath: success for source, fail for destination
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath) // Source resolves fine
        .mockRejectedValueOnce(resolveError); // Destination resolve fails

      await expect(
        famService.move(userIdA, sourceLogicalPath, destinationLogicalPath)
      ).rejects.toThrow(resolveError);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledTimes(2);

      // existsSpy should not be called as the second resolvePath fails before any exists calls in move()
      if (existsSpy) {
        expect(existsSpy).not.toHaveBeenCalled();
      }

      expect(ensurePhysicalDirExistsSpy).not.toHaveBeenCalled();
      expect(fsRenameSpy).not.toHaveBeenCalled();
    });
    it("should throw error if fsPromises.rename fails", async () => {
      const sourceLogicalPath = "user://source-for-rename-fail.txt";
      const destinationLogicalPath = "user://dest-for-rename-fail.txt";

      const sourcePhysicalPath = path.join(tempUserARoot_physical, "source-for-rename-fail.txt");
      const destinationPhysicalPath = path.join(tempUserARoot_physical, "dest-for-rename-fail.txt");
      const renameError = new Error("FS: Rename operation failed (e.g., permission denied)");

      // Mocking resolvePath
      resolvePathSpy = spyOn(famService, "resolvePath")
        .mockResolvedValueOnce(sourcePhysicalPath)
        .mockResolvedValueOnce(destinationPhysicalPath);

      // Mocking exists: Source exists, Destination does not
      existsSpy = spyOn(famService, "exists")
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(false); // Destination does not exist

      // Mock fsPromises.rename to fail
      // fsRenameSpy is initialized in beforeEach for the 'move' describe block
      fsRenameSpy!.mockRejectedValueOnce(renameError);

      await expect(
        famService.move(userIdA, sourceLogicalPath, destinationLogicalPath)
      ).rejects.toThrow(renameError);

      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(resolvePathSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, sourceLogicalPath);
      expect(existsSpy).toHaveBeenCalledWith(userIdA, destinationLogicalPath, true);
      expect(ensurePhysicalDirExistsSpy).toHaveBeenCalledWith(destinationPhysicalPath);
      expect(fsRenameSpy).toHaveBeenCalledWith(sourcePhysicalPath, destinationPhysicalPath); // Verify it was called
    });

    // More tests for move will be added here...
  });
});
